import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, db } from "@/db";
import { funnelEvents } from "@/db/schema";
import { jar } from "../../../test/cookie-jar";
import { resetDb } from "../../../test/db";
import { aidInput, forceDecision, makeUser, projectInput, signInAsAdmin } from "../../../test/factories";
import { fake, installFakeProviders } from "../../../test/fake-providers";

vi.mock("next/headers", async () => (await import("../../../test/cookie-jar")).nextHeadersMock());
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const { decide, getApplicationDetail, listApplications } = await import("./service");
const { decideAction } = await import("@/app/admin/actions");
const { requireAdmin, requireAdminForAction } = await import("@/lib/auth/guards");
const { createSession } = await import("@/lib/auth/session");
const { getApplicantState, submitApplication } = await import("@/lib/applications/service");
const { funnelReport } = await import("./funnel");
const { countPendingSync, syncReviewsToAirtable } = await import("@/lib/airtable/sync");

/** Every admin data-layer function, called with harmless arguments. */
const adminDataCalls = (id: string) => ({
  listApplications: () => listApplications({}),
  getApplicationDetail: () => getApplicationDetail(id),
  decide: () => decide(id, "approve", "", "solid work"),
  funnelReport: () => funnelReport(new Date(0), new Date()),
  countPendingSync: () => countPendingSync(),
  syncReviewsToAirtable: () => syncReviewsToAirtable(),
});

beforeEach(async () => {
  await resetDb();
  jar.clear();
  fake.reset();
  installFakeProviders();
});
afterAll(closeDb);

const admin = signInAsAdmin;

async function projectApp() {
  const u = await makeUser();
  fake.tokens.set(`t-${u.id}`, { sub: u.hcId });
  fake.projects.set(u.hcId, [{ name: "big-project", total_seconds: 9000 }]);
  const r = await submitApplication(u, projectInput, `t-${u.id}`);
  if (!r.ok) throw new Error("setup");
  return { user: u, id: r.id };
}

async function aidApp() {
  const u = await makeUser();
  const r = await submitApplication(u, aidInput, null);
  if (!r.ok) throw new Error("setup");
  return { user: u, id: r.id };
}

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

describe("admin access", () => {
  it("refuses non-admins on every admin action and page guard", async () => {
    const u = await makeUser("ident!not-admin");
    await createSession(u.id);
    await expect(requireAdminForAction()).rejects.toThrow("Forbidden");
    await expect(decideAction(null, form({ id: "x", decision: "approve" }))).rejects.toThrow("Forbidden");
    await expect(requireAdmin()).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it("refuses signed-out visitors", async () => {
    await expect(decideAction(null, form({ id: "x", decision: "approve" }))).rejects.toThrow("Forbidden");
    await expect(requireAdmin()).rejects.toThrow(/NEXT_REDIRECT/);
  });

  it("refuses signed-out visitors and non-admins in the data layer, not just the pages", async () => {
    const { id } = await aidApp();
    for (const [name, call] of Object.entries(adminDataCalls(id))) {
      jar.clear();
      await expect(call(), `${name} signed out`).rejects.toThrow("Forbidden");
      await createSession((await makeUser()).id);
      await expect(call(), `${name} as non-admin`).rejects.toThrow("Forbidden");
    }
    // Nothing was decided along the way.
    await signInAsAdmin();
    expect((await getApplicationDetail(id))?.app.status).toBe("submitted");
  });

  it("records the signed-in admin as the decider", async () => {
    const a = await signInAsAdmin();
    const { id } = await aidApp();
    await decide(id, "approve", "", "solid work");
    expect((await getApplicationDetail(id))?.decidedBy).toBe(`Name ident!admin1`);
    expect(a.isAdmin).toBe(true);
  });

  it("allows allowlisted admins", async () => {
    const a = await admin();
    await createSession(a.id);
    expect((await requireAdminForAction()).id).toBe(a.id);
  });
});

describe("review list", () => {
  it("filters by type and status", async () => {
    await admin();
    const p = await projectApp();
    const pendingAid = await aidApp();
    const decidedAid = await aidApp();
    await decide(decidedAid.id, "approve", "", "solid work");
    const rows = await listApplications({ kind: "aid", status: "submitted" });
    expect(rows.map((r) => r.id)).toEqual([pendingAid.id]);
    expect((await listApplications({})).map((r) => r.id).sort()).toEqual([p.id, pendingAid.id, decidedAid.id].sort());
  });
});

describe("decisions", () => {
  it("approves into an interview, recording who and when, and emits a decided event", async () => {
    await admin();
    const { id, user } = await projectApp();
    expect(await decide(id, "approve", "", "solid work")).toEqual({ ok: true });
    const d = await getApplicationDetail(id);
    expect(d?.app.status).toBe("interview");
    expect(d?.decidedBy).toBe("Name ident!admin1");
    expect(d?.app.decidedAt).toBeInstanceOf(Date);
    expect(d?.round2).toBeNull();
    const state = await getApplicantState(user);
    expect(state.live?.status).toBe("interview");
    // still under consideration: no new application, no deleting
    expect(state.canSubmit).toBe(false);
    const events = await db().select().from(funnelEvents);
    expect(events.find((e) => e.step === "decided")?.meta).toEqual({ decision: "interview" });
  });

  it.each(["reject_cut", "reject_malformed"] as const)("refuses %s with an empty note", async (decision) => {
    const a = await admin();
    const { id } = await projectApp();
    expect(await decide(id, decision, "   ")).toEqual({ ok: false, error: "note_required" });
    await createSession(a.id);
    expect(await decideAction(null, form({ id, decision, note: "" }))).toEqual({ error: expect.stringMatching(/required/) });
    expect((await getApplicationDetail(id))?.app.status).toBe("submitted");
  });

  it("refuses a second decision", async () => {
    await admin();
    const { id } = await projectApp();
    await decide(id, "reject_cut", "not this time", "too thin");
    expect(await decide(id, "approve", "", "solid work")).toEqual({ ok: false, error: "already_decided" });
    expect((await getApplicationDetail(id))?.app.status).toBe("rejected_cut");
  });

  it("malformed shows Needs changes with the note and allows resubmitting", async () => {
    await admin();
    const { id, user } = await aidApp();
    await decide(id, "reject_malformed", "the video is private");
    const state = await getApplicantState(user);
    expect(state.live).toMatchObject({ status: "rejected_malformed", note: "the video is private" });
    expect(state.canSubmit).toBe(true);
  });

  it("shows replaced applications as history on the resubmission", async () => {
    await admin();
    const { id, user } = await aidApp();
    await decide(id, "reject_malformed", "fix the link");
    const again = await submitApplication(user, aidInput, null);
    if (!again.ok) throw new Error("resubmit");
    const d = await getApplicationDetail(again.id);
    expect(d?.history.map((h) => [h.id, h.note])).toEqual([[id, "fix the link"]]);
    expect((await getApplicationDetail(id))?.live).toBe(false);
    // the replaced application can't be decided again
    expect(await decide(id, "approve", "", "solid work")).toEqual({ ok: false, error: "already_decided" });
  });
});

describe("four decision types", () => {
  it("requires a justification to approve or cut, and keeps it internal", async () => {
    await admin();
    const { id, user } = await projectApp();
    expect(await decide(id, "approve", "", "  ")).toEqual({ ok: false, error: "justification_required" });
    expect(await decide(id, "reject_cut", "not this time")).toEqual({ ok: false, error: "justification_required" });
    expect(await decide(id, "approve", "", "great demo, hours check out")).toEqual({ ok: true });
    expect((await getApplicationDetail(id))?.justification).toBe("great demo, hours check out");
    // the applicant's view never carries it
    expect(JSON.stringify((await getApplicantState(user)).live)).not.toContain("great demo");
  });

  it("needs changes takes a note and no justification", async () => {
    await admin();
    const { id } = await projectApp();
    expect(await decide(id, "reject_malformed", "fix the link", "ignored")).toEqual({ ok: true });
    expect((await getApplicationDetail(id))?.justification).toBeNull();
  });

  it("fraud bans the applicant: no reapplying, no aid, no note to them", async () => {
    await admin();
    const { id, user } = await projectApp();
    expect(await decide(id, "reject_fraud", "", "")).toEqual({ ok: false, error: "justification_required" });
    expect(await decide(id, "reject_fraud", "you cheated", "hours were faked with a script")).toEqual({ ok: true });
    const d = await getApplicationDetail(id);
    expect(d).toMatchObject({ banned: true, justification: "hours were faked with a script" });
    expect(d?.app).toMatchObject({ status: "rejected_fraud", note: null });
    expect(await getApplicantState(user)).toMatchObject({ canSubmit: false, aidAvailable: false, banned: true });
    const again = await submitApplication(user, projectInput, `t-${user.id}`);
    expect(again).toMatchObject({ ok: false, errors: { form: /can't apply/ } });
  });
});

describe("second-round interview", () => {
  async function invited(note = "") {
    await admin();
    const app = await projectApp();
    expect(await decide(app.id, "approve", note, "first pass")).toEqual({ ok: true });
    return app;
  }

  it("selects after the interview, keeping both rounds on record", async () => {
    const { id, user } = await invited("see you on the call");
    expect(await decide(id, "select", "great call", "strong interview")).toEqual({ ok: true });
    const d = await getApplicationDetail(id);
    expect(d?.app.status).toBe("approved");
    expect(d?.app.round2).toBe(true);
    expect(d?.app.note).toBe("great call");
    expect(d?.firstNote).toBe("see you on the call");
    expect(d?.justification).toBe("first pass");
    expect(d?.round2).toMatchObject({ decidedBy: "Name ident!admin1", note: "great call", justification: "strong interview" });
    expect(d?.round2?.decidedAt).toBeInstanceOf(Date);
    expect(d?.app.decidedAt).toEqual(d?.round2?.decidedAt);
    expect((await getApplicantState(user)).live?.status).toBe("approved");
    const events = await db().select().from(funnelEvents);
    expect(events.filter((e) => e.step === "decided").map((e) => e.meta)).toEqual([{ decision: "interview" }]);
    expect(events.filter((e) => e.step === "interviewed").map((e) => e.meta)).toEqual([{ decision: "approved" }]);
  });

  it("shows no note after selecting without one, even if the invite had one", async () => {
    const { id } = await invited("see you on the call");
    await decide(id, "select", "", "strong interview");
    expect((await getApplicationDetail(id))?.app.note).toBeNull();
  });

  it("cuts after the interview with a required note, and lets them apply again", async () => {
    const { id, user } = await invited();
    expect(await decide(id, "reject_cut", " ", "weak call")).toEqual({ ok: false, error: "note_required" });
    expect(await decide(id, "reject_cut", "not this round", "weak call")).toEqual({ ok: true });
    const state = await getApplicantState(user);
    expect(state.live).toMatchObject({ status: "rejected_cut", note: "not this round", round2: true });
    expect(state.canSubmit).toBe(true);
    expect((await getApplicationDetail(id))?.justification).toBe("first pass");
  });

  it("refuses needs changes and a second approve in round two", async () => {
    const { id } = await invited();
    expect(await decide(id, "reject_malformed", "fix it")).toEqual({ ok: false, error: "wrong_round" });
    expect(await decide(id, "approve", "", "again")).toEqual({ ok: false, error: "already_decided" });
    expect((await getApplicationDetail(id))?.app.status).toBe("interview");
  });

  it("refuses select before the interview stage", async () => {
    const a = await admin();
    const { id } = await projectApp();
    expect(await decide(id, "select", "", "skip ahead")).toEqual({ ok: false, error: "wrong_round" });
    await createSession(a.id);
    expect(await decideAction(null, form({ id, decision: "select", justification: "x" }))).toEqual({
      error: expect.stringMatching(/stage/),
    });
    expect((await getApplicationDetail(id))?.app.status).toBe("submitted");
  });

  it("leaves applications approved before interviews existed as final", async () => {
    const a = await admin();
    const { id } = await projectApp();
    await forceDecision(id, "approved", a.id);
    expect(await decide(id, "select", "", "x")).toEqual({ ok: false, error: "already_decided" });
    expect(await decide(id, "reject_cut", "n", "x")).toEqual({ ok: false, error: "already_decided" });
  });

  it("decides round two only once", async () => {
    const { id } = await invited();
    const results = await Promise.all([decide(id, "select", "", "a"), decide(id, "reject_cut", "n", "b")]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({ ok: false, error: "already_decided" });
  });

  it("rejects for fraud after the interview and bans the founder", async () => {
    const { id, user } = await invited();
    expect(await decide(id, "reject_fraud", "", "faked hours")).toEqual({ ok: true });
    const d = await getApplicationDetail(id);
    expect(d?.app.status).toBe("rejected_fraud");
    expect(d?.banned).toBe(true);
    expect((await getApplicantState(user)).canSubmit).toBe(false);
  });
});
