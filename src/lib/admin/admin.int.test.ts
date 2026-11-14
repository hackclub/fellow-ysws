import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, db } from "@/db";
import { funnelEvents } from "@/db/schema";
import { jar } from "../../../test/cookie-jar";
import { resetDb } from "../../../test/db";
import { aidInput, makeUser, projectInput } from "../../../test/factories";
import { fake, installFakeProviders } from "../../../test/fake-providers";

vi.mock("next/headers", async () => (await import("../../../test/cookie-jar")).nextHeadersMock());
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const { decide, getApplicationDetail, listApplications } = await import("./service");
const { decideAction } = await import("@/app/admin/actions");
const { requireAdmin, requireAdminForAction } = await import("@/lib/auth/guards");
const { createSession, loadUser } = await import("@/lib/auth/session");
const { getApplicantState, submitApplication } = await import("@/lib/applications/service");

beforeEach(async () => {
  await resetDb();
  jar.clear();
  fake.reset();
  installFakeProviders();
});
afterAll(closeDb);

async function admin() {
  const a = await makeUser("ident!admin1"); // allowlisted in test/setup-env.ts
  return (await loadUser(a.id))!;
}

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

  it("allows allowlisted admins", async () => {
    const a = await admin();
    await createSession(a.id);
    expect((await requireAdminForAction()).id).toBe(a.id);
  });
});

describe("review list", () => {
  it("filters by type and status", async () => {
    const a = await admin();
    const p = await projectApp();
    const pendingAid = await aidApp();
    const decidedAid = await aidApp();
    await decide(a, decidedAid.id, "approve", "", "solid work");
    const rows = await listApplications({ kind: "aid", status: "submitted" });
    expect(rows.map((r) => r.id)).toEqual([pendingAid.id]);
    expect((await listApplications({})).map((r) => r.id).sort()).toEqual([p.id, pendingAid.id, decidedAid.id].sort());
  });
});

describe("decisions", () => {
  it("approves, recording who and when, and emits a decided event", async () => {
    const a = await admin();
    const { id, user } = await projectApp();
    expect(await decide(a, id, "approve", "", "solid work")).toEqual({ ok: true });
    const d = await getApplicationDetail(id);
    expect(d?.app.status).toBe("approved");
    expect(d?.decidedBy).toBe("Name ident!admin1");
    expect(d?.app.decidedAt).toBeInstanceOf(Date);
    expect((await getApplicantState(user)).live?.status).toBe("approved");
    const events = await db().select().from(funnelEvents);
    expect(events.find((e) => e.step === "decided")?.meta).toEqual({ decision: "approved" });
  });

  it.each(["reject_cut", "reject_malformed"] as const)("refuses %s with an empty note", async (decision) => {
    const a = await admin();
    const { id } = await projectApp();
    expect(await decide(a, id, decision, "   ")).toEqual({ ok: false, error: "note_required" });
    await createSession(a.id);
    expect(await decideAction(null, form({ id, decision, note: "" }))).toEqual({ error: expect.stringMatching(/required/) });
    expect((await getApplicationDetail(id))?.app.status).toBe("submitted");
  });

  it("refuses a second decision", async () => {
    const a = await admin();
    const { id } = await projectApp();
    await decide(a, id, "reject_cut", "not this time", "too thin");
    expect(await decide(a, id, "approve", "", "solid work")).toEqual({ ok: false, error: "already_decided" });
    expect((await getApplicationDetail(id))?.app.status).toBe("rejected_cut");
  });

  it("malformed shows Needs changes with the note and allows resubmitting", async () => {
    const a = await admin();
    const { id, user } = await aidApp();
    await decide(a, id, "reject_malformed", "the video is private");
    const state = await getApplicantState(user);
    expect(state.live).toMatchObject({ status: "rejected_malformed", note: "the video is private" });
    expect(state.canSubmit).toBe(true);
  });

  it("shows replaced applications as history on the resubmission", async () => {
    const a = await admin();
    const { id, user } = await aidApp();
    await decide(a, id, "reject_malformed", "fix the link");
    const again = await submitApplication(user, aidInput, null);
    if (!again.ok) throw new Error("resubmit");
    const d = await getApplicationDetail(again.id);
    expect(d?.history.map((h) => [h.id, h.note])).toEqual([[id, "fix the link"]]);
    expect((await getApplicationDetail(id))?.live).toBe(false);
    // the replaced application can't be decided again
    expect(await decide(a, id, "approve", "", "solid work")).toEqual({ ok: false, error: "already_decided" });
  });
});

describe("four decision types", () => {
  it("requires a justification to approve or cut, and keeps it internal", async () => {
    const a = await admin();
    const { id, user } = await projectApp();
    expect(await decide(a, id, "approve", "", "  ")).toEqual({ ok: false, error: "justification_required" });
    expect(await decide(a, id, "reject_cut", "not this time")).toEqual({ ok: false, error: "justification_required" });
    expect(await decide(a, id, "approve", "", "great demo, hours check out")).toEqual({ ok: true });
    expect((await getApplicationDetail(id))?.justification).toBe("great demo, hours check out");
    // the applicant's view never carries it
    expect(JSON.stringify((await getApplicantState(user)).live)).not.toContain("great demo");
  });

  it("needs changes takes a note and no justification", async () => {
    const a = await admin();
    const { id } = await projectApp();
    expect(await decide(a, id, "reject_malformed", "fix the link", "ignored")).toEqual({ ok: true });
    expect((await getApplicationDetail(id))?.justification).toBeNull();
  });

  it("fraud bans the applicant: no reapplying, no aid, no note to them", async () => {
    const a = await admin();
    const { id, user } = await projectApp();
    expect(await decide(a, id, "reject_fraud", "", "")).toEqual({ ok: false, error: "justification_required" });
    expect(await decide(a, id, "reject_fraud", "you cheated", "hours were faked with a script")).toEqual({ ok: true });
    const d = await getApplicationDetail(id);
    expect(d).toMatchObject({ banned: true, justification: "hours were faked with a script" });
    expect(d?.app).toMatchObject({ status: "rejected_fraud", note: null });
    expect(await getApplicantState(user)).toMatchObject({ canSubmit: false, aidAvailable: false, banned: true });
    const again = await submitApplication(user, projectInput, `t-${user.id}`);
    expect(again).toMatchObject({ ok: false, errors: { form: /can't apply/ } });
  });
});
