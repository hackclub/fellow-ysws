import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, db } from "@/db";
import { aidClaims, applications, funnelEvents, users } from "@/db/schema";
import { jar } from "../../../test/cookie-jar";
import { resetDb } from "../../../test/db";
import { aidInput, forceDecision, makeUser, projectInput } from "../../../test/factories";
import { fake, installFakeProviders } from "../../../test/fake-providers";

vi.mock("next/headers", async () => (await import("../../../test/cookie-jar")).nextHeadersMock());
const { deleteApplication, getApplicantState, submitApplication, predecessorsOf } = await import("./service");

const TOKEN = "tok-hackatime";

beforeEach(async () => {
  await resetDb();
  jar.clear();
  fake.reset();
  installFakeProviders();
});
afterAll(closeDb);

async function userWithProjects(projects = [{ name: "big-project", total_seconds: 14 * 3600 + 1800 }]) {
  const u = await makeUser();
  fake.tokens.set(TOKEN, { sub: u.hcId });
  fake.projects.set(u.hcId, projects);
  return u;
}

describe("project submissions", () => {
  it("stores a snapshot of logged hours and credits exactly 2 hours", async () => {
    const u = await userWithProjects();
    const r = await submitApplication(u, projectInput, TOKEN);
    expect(r.ok).toBe(true);
    const state = await getApplicantState(u);
    expect(state.live).toMatchObject({ kind: "project", status: "submitted", hackatimeSecondsSnapshot: 52200, creditedSeconds: 7200 });
    // later Hackatime changes don't touch the snapshot
    fake.projects.set(u.hcId, [{ name: "big-project", total_seconds: 99 * 3600 }]);
    expect((await getApplicantState(u)).live?.hackatimeSecondsSnapshot).toBe(52200);
  });

  it("snapshots the Hackatime account id on the application and the user", async () => {
    const u = await userWithProjects();
    fake.hackatimeIds.set(u.hcId, 8997);
    expect((await submitApplication(u, projectInput, TOKEN)).ok).toBe(true);
    expect((await getApplicantState(u)).live?.hackatimeId).toBe("8997");
    const [user] = await db().select().from(users).where(eq(users.id, u.id));
    expect(user.hackatimeIdEnc).toBeTruthy();
  });

  it("submits without a Hackatime id when Hackatime doesn't return one", async () => {
    const u = await userWithProjects();
    fake.hackatimeIds.set(u.hcId, null);
    expect((await submitApplication(u, projectInput, TOKEN)).ok).toBe(true);
    expect((await getApplicantState(u)).live?.hackatimeId).toBeNull();
  });

  it("rejects projects that aren't the user's or are under 2 hours", async () => {
    const u = await userWithProjects([{ name: "big-project", total_seconds: 7199 }]);
    const r = await submitApplication(u, projectInput, TOKEN);
    expect(r).toEqual({ ok: false, errors: { hackatimeProject: expect.stringMatching(/isn't one of your/) } });
    const r2 = await submitApplication(u, { ...projectInput, hackatimeProject: "someone-elses" }, TOKEN);
    expect(r2.ok).toBe(false);
  });

  it("asks to reconnect when there is no Hackatime token, and reports Hackatime outages", async () => {
    const u = await userWithProjects();
    expect(await submitApplication(u, projectInput, null)).toMatchObject({ ok: false, errors: { hackatimeProject: /reconnect/ } });
    fake.hackatimeDown = true;
    expect(await submitApplication(u, projectInput, TOKEN)).toMatchObject({ ok: false, errors: { hackatimeProject: /unavailable/ } });
    expect(await db().select().from(applications)).toHaveLength(0);
  });

  it("records a submitted funnel event with the kind", async () => {
    const u = await userWithProjects();
    await submitApplication(u, projectInput, TOKEN);
    const [e] = await db().select().from(funnelEvents);
    expect(e).toMatchObject({ step: "submitted", userId: u.id, meta: { kind: "project" } });
  });
});

describe("One live application per user", () => {
  it.each(["submitted", "approved"] as const)("blocks a second submission while %s", async (status) => {
    const u = await userWithProjects();
    const admin = await makeUser();
    const first = await submitApplication(u, projectInput, TOKEN);
    if (status !== "submitted" && first.ok) await forceDecision(first.id, status, admin.id);
    const second = await submitApplication(u, projectInput, TOKEN);
    expect(second).toMatchObject({ ok: false, errors: { form: /already applied/ } });
    expect((await getApplicantState(u)).canSubmit).toBe(false);
  });
});

describe("Reapplying after a cut", () => {
  it("lets a cut applicant apply again, replacing the cut application", async () => {
    const u = await userWithProjects();
    const admin = await makeUser();
    const first = await submitApplication(u, projectInput, TOKEN);
    if (first.ok) await forceDecision(first.id, "rejected_cut", admin.id);
    expect((await getApplicantState(u)).canSubmit).toBe(true);
    const second = await submitApplication(u, projectInput, TOKEN);
    expect(second.ok).toBe(true);
    const live = (await getApplicantState(u)).live!;
    expect(live).toMatchObject({ status: "submitted" });
    expect(live.id).not.toBe(first.ok && first.id);
    expect(await db().select().from(applications)).toHaveLength(2);
  });

  it("hands the cut application back when the reapplication is deleted", async () => {
    const u = await userWithProjects();
    const admin = await makeUser();
    const first = await submitApplication(u, projectInput, TOKEN);
    if (first.ok) await forceDecision(first.id, "rejected_cut", admin.id);
    await submitApplication(u, projectInput, TOKEN);
    expect(await deleteApplication(u)).toEqual({ ok: true });
    expect((await getApplicantState(u)).live).toMatchObject({ status: "rejected_cut" });
  });
});

describe("Pending-only deletion", () => {
  it("deletes a pending application and its content, then allows a new one", async () => {
    const u = await userWithProjects();
    await submitApplication(u, projectInput, TOKEN);
    expect(await deleteApplication(u)).toEqual({ ok: true });
    expect(await db().select().from(applications)).toHaveLength(0);
    expect((await submitApplication(u, projectInput, TOKEN)).ok).toBe(true);
  });

  it.each(["approved", "rejected_cut", "rejected_malformed"] as const)("refuses to delete when %s", async (status) => {
    const u = await userWithProjects();
    const admin = await makeUser();
    const r = await submitApplication(u, projectInput, TOKEN);
    if (r.ok) await forceDecision(r.id, status, admin.id);
    expect(await deleteApplication(u)).toEqual({ ok: false, reason: "decided" });
    expect(await db().select().from(applications)).toHaveLength(1);
  });
});

describe("One financial-aid attempt per user", () => {
  it("accepts an aid application without Hackatime and claims the aid attempt", async () => {
    const u = await makeUser();
    expect((await submitApplication(u, aidInput, null)).ok).toBe(true);
    expect(await db().select().from(aidClaims)).toHaveLength(1);
    const live = (await getApplicantState(u)).live!;
    expect(live).toMatchObject({ kind: "aid", hackatimeSecondsSnapshot: null, creditedSeconds: null });
    expect(live.content).toMatchObject({ videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
  });

  it("keeps the aid attempt used after deleting a pending aid application", async () => {
    const u = await userWithProjects();
    await submitApplication(u, aidInput, null);
    await deleteApplication(u);
    expect(await db().select().from(aidClaims)).toHaveLength(1);
    const state = await getApplicantState(u);
    expect(state).toMatchObject({ live: null, canSubmit: true, aidAvailable: false });
    expect(await submitApplication(u, aidInput, null)).toMatchObject({ ok: false, errors: { form: /only be requested once/ } });
    expect((await submitApplication(u, projectInput, TOKEN)).ok).toBe(true);
  });

  it("allows only a project reapplication after an aid application is cut", async () => {
    const u = await userWithProjects();
    const admin = await makeUser();
    const r = await submitApplication(u, aidInput, null);
    if (r.ok) await forceDecision(r.id, "rejected_cut", admin.id);
    expect(await getApplicantState(u)).toMatchObject({ canSubmit: true, aidAvailable: false });
    expect(await submitApplication(u, aidInput, null)).toMatchObject({ ok: false, errors: { form: /only be requested once/ } });
    expect((await submitApplication(u, projectInput, TOKEN)).ok).toBe(true);
  });

  it("lets a 'Needs changes' aid application be resubmitted as aid", async () => {
    const u = await makeUser();
    const admin = await makeUser();
    const r = await submitApplication(u, aidInput, null);
    if (r.ok) await forceDecision(r.id, "rejected_malformed", admin.id);
    expect(await getApplicantState(u)).toMatchObject({ canSubmit: true, aidAvailable: true });
    const again = await submitApplication(u, { ...aidInput, aidReason: "fixed" }, null);
    expect(again.ok).toBe(true);
    expect(await db().select().from(aidClaims)).toHaveLength(1);
  });

  it("rejects private or missing videos and fails closed when YouTube is unreachable", async () => {
    const u = await makeUser();
    const priv = await submitApplication(u, { ...aidInput, videoUrl: "https://youtu.be/privateABCD" }, null);
    expect(priv).toMatchObject({ ok: false, errors: { videoUrl: /unlisted, not private/ } });
    const builder = await userWithProjects();
    const privProject = await submitApplication(builder, { ...projectInput, videoUrl: "https://youtu.be/privateABCD" }, TOKEN);
    expect(privProject).toMatchObject({ ok: false, errors: { videoUrl: /unlisted, not private/ } });
    fake.youtubeDown = true;
    expect(await submitApplication(u, aidInput, null)).toMatchObject({ ok: false, errors: { videoUrl: /couldn't reach youtube/ } });
    expect(await db().select().from(aidClaims)).toHaveLength(0);
  });
});

describe("Resubmission after Needs changes", () => {
  it("replaces the live application and keeps the old one as history", async () => {
    const u = await userWithProjects();
    const admin = await makeUser();
    const first = await submitApplication(u, projectInput, TOKEN);
    if (!first.ok) throw new Error("setup");
    await forceDecision(first.id, "rejected_malformed", admin.id);
    const second = await submitApplication(u, { ...projectInput, description: "v2" }, TOKEN);
    if (!second.ok) throw new Error("resubmit failed");
    const state = await getApplicantState(u);
    expect(state.live).toMatchObject({ id: second.id, status: "submitted" });
    const [old] = await db().select().from(applications).where(eq(applications.id, first.id));
    expect(old.supersededById).toBe(second.id);
    expect((await predecessorsOf(second.id)).map((a) => a.id)).toEqual([first.id]);
  });

  it("deleting a pending resubmission brings back the Needs changes application", async () => {
    const u = await userWithProjects();
    const admin = await makeUser();
    const first = await submitApplication(u, projectInput, TOKEN);
    if (!first.ok) throw new Error("setup");
    await forceDecision(first.id, "rejected_malformed", admin.id);
    await submitApplication(u, projectInput, TOKEN);
    expect(await deleteApplication(u)).toEqual({ ok: true });
    expect((await getApplicantState(u)).live).toMatchObject({ id: first.id, status: "rejected_malformed" });
  });
});

describe("concurrency", () => {
  it("two simultaneous submissions produce exactly one application", async () => {
    const u = await userWithProjects();
    const results = await Promise.allSettled([
      submitApplication(u, projectInput, TOKEN),
      submitApplication(u, projectInput, TOKEN),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled" && r.value.ok);
    expect(ok).toHaveLength(1);
    expect(await db().select().from(applications)).toHaveLength(1);
  });
});
