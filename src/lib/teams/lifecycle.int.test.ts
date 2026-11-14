import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, db } from "@/db";
import { aidClaims, applicationMembers, applications, teams } from "@/db/schema";
import type { CurrentUser } from "@/lib/auth/session";
import { hcIdHash } from "@/lib/crypto";
import { jar } from "../../../test/cookie-jar";
import { resetDb } from "../../../test/db";
import { aidInput, makeUser, projectInput } from "../../../test/factories";
import { fake, installFakeProviders } from "../../../test/fake-providers";

vi.mock("next/headers", async () => (await import("../../../test/cookie-jar")).nextHeadersMock());
const t = await import("./service");
const { submitApplication, deleteApplication, getApplicantState } = await import("@/lib/applications/service");
const { decide, getApplicationDetail } = await import("@/lib/admin/service");

beforeEach(async () => {
  await resetDb();
  jar.clear();
  fake.reset();
  installFakeProviders();
});
afterAll(closeDb);

type U = { id: string; hcId: string };

/** A user with a 14h Hackatime project, and the token to submit with. */
async function applicant(): Promise<U & { token: string }> {
  const u = await makeUser();
  const token = `tok-${u.id}`;
  fake.tokens.set(token, { sub: u.hcId });
  fake.projects.set(u.hcId, [{ name: "big-project", total_seconds: 14 * 3600 }]);
  return { ...u, token };
}

async function teamOf(partners: number) {
  const founder = await applicant();
  const formed = await t.formTeam(founder);
  if (!formed.ok) throw new Error(formed.reason);
  const ps: U[] = [];
  for (let i = 0; i < partners; i++) {
    const p = await applicant();
    expect((await t.joinTeam(p, formed.team.inviteToken!)).ok).toBe(true);
    ps.push(p);
  }
  return { founder, partners: ps, teamId: formed.team.id, token: formed.team.inviteToken! };
}

const version = async (userId: string) => (await t.getMyTeam(userId))!.team.version;

async function submitAs(founder: U & { token: string }, input = projectInput) {
  const v = (await t.getMyTeam(founder.id))?.team.version ?? null;
  const r = await submitApplication(founder, input, founder.token, v);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.id;
}

async function adminUser(): Promise<CurrentUser> {
  const a = await makeUser("ident!admin1");
  return { ...a, isAdmin: true, name: "admin", email: null, slackId: null, hackatimeConnectedAt: null };
}

const membersOf = async (appId: string) =>
  (await db().select().from(applicationMembers).where(eq(applicationMembers.applicationId, appId)))
    .map((m) => `${m.role}:${m.userId}`)
    .sort();

describe("Team locks at submission", () => {
  it("records the founder and partners on the application and locks the team", async () => {
    const { founder, partners, teamId, token } = await teamOf(2);
    const appId = await submitAs(founder);
    expect(await membersOf(appId)).toEqual(
      [`founder:${founder.id}`, ...partners.map((p) => `partner:${p.id}`)].sort(),
    );
    const [app] = await db().select().from(applications).where(eq(applications.id, appId));
    expect(app.teamId).toBe(teamId);
    const [team] = await db().select().from(teams).where(eq(teams.id, teamId));
    expect(team.lockedAt).not.toBeNull();
    expect(await t.inspectInvite(token, null)).toEqual({ ok: false, reason: "applied" });
    expect(await t.kickPartner(founder, partners[0].id)).toEqual({ ok: false, reason: "locked" });
  });

  it("refuses a submission when the team changed after the form loaded, without writing anything", async () => {
    const { founder, partners } = await teamOf(1);
    const seen = await version(founder.id);
    await t.leaveTeam(partners[0]);
    const r = await submitApplication(founder, aidInput, founder.token, seen);
    expect(r).toEqual({ ok: false, errors: { team: expect.stringMatching(/team changed/) } });
    expect(await db().select().from(applications)).toHaveLength(0);
    expect(await db().select().from(aidClaims)).toHaveLength(0);
  });

  it("refuses when the form showed a team that has since been dissolved", async () => {
    const { founder } = await teamOf(0);
    const seen = await version(founder.id);
    await t.dissolveTeam(founder);
    expect(await submitApplication(founder, projectInput, founder.token, seen)).toMatchObject({
      ok: false,
      errors: { team: expect.any(String) },
    });
  });

  it("submits solo applications with the founder as the only member", async () => {
    const solo = await applicant();
    const soloId = await submitAs(solo);
    expect(await membersOf(soloId)).toEqual([`founder:${solo.id}`]);

    const { founder, partners } = await teamOf(1);
    await t.leaveTeam(partners[0]);
    const appId = await submitAs(founder);
    expect(await membersOf(appId)).toEqual([`founder:${founder.id}`]);
  });
});

describe("One live application per user (partners)", () => {
  it("blocks a partner on an open team or a pending application from applying", async () => {
    const { founder, partners } = await teamOf(1);
    const p = partners[0] as U & { token: string };
    expect(await submitApplication(p, projectInput, p.token, null)).toMatchObject({
      ok: false,
      errors: { form: expect.stringMatching(/partner on someone else's team/) },
    });
    await submitAs(founder);
    expect((await submitApplication(p, projectInput, p.token, null)).ok).toBe(false);
  });
});

describe("Fee and aid unaffected by team size", () => {
  it("credits only the founder's project with 2 hours", async () => {
    const { founder } = await teamOf(3);
    const appId = await submitAs(founder);
    const [app] = await db().select().from(applications).where(eq(applications.id, appId));
    expect(app).toMatchObject({ userId: founder.id, creditedSeconds: 7200, hackatimeSecondsSnapshot: 14 * 3600 });
  });

  it("uses up only the founder's aid attempt", async () => {
    const admin = await adminUser();
    const { founder, partners } = await teamOf(2);
    const appId = await submitAs(founder, aidInput);
    const claims = (await db().select().from(aidClaims)).map((c) => c.hcIdHash);
    expect(claims).toEqual([hcIdHash(founder.hcId)]);
    await decide(admin, appId, "reject_cut", "not this time", "too thin");
    const state = await getApplicantState(partners[0]);
    expect(state.aidAvailable).toBe(true);
    const p = partners[0] as U & { token: string };
    expect((await submitApplication(p, aidInput, p.token, null)).ok).toBe(true);
  });
});

describe("Team reopens on Needs changes", () => {
  it("lets the founder change the team, and the resubmission records the new team", async () => {
    const admin = await adminUser();
    const { founder, partners, teamId } = await teamOf(2);
    const first = await submitAs(founder);
    await decide(admin, first, "reject_malformed", "who is on this team?");

    const [team] = await db().select().from(teams).where(eq(teams.id, teamId));
    expect(team.lockedAt).toBeNull();
    // Partners stay tied up while it needs changes.
    expect(await t.formTeam(partners[0])).toEqual({ ok: false, reason: "on_team" });

    const kicked = await t.kickPartner(founder, partners[0].id);
    expect(kicked.ok).toBe(true);
    const newcomer = await applicant();
    expect((await t.joinTeam(newcomer, kicked.ok ? kicked.team.inviteToken! : "")).ok).toBe(true);

    const second = await submitAs(founder);
    expect(await membersOf(second)).toEqual(
      [`founder:${founder.id}`, `partner:${partners[1].id}`, `partner:${newcomer.id}`].sort(),
    );
    // The replaced application keeps the team it was submitted with.
    expect(await membersOf(first)).toEqual(
      [`founder:${founder.id}`, ...partners.map((p) => `partner:${p.id}`)].sort(),
    );
    const [relocked] = await db().select().from(teams).where(eq(teams.id, teamId));
    expect(relocked.lockedAt).not.toBeNull();
  });
});

describe("Partners are released", () => {
  it.each(["approve", "reject_cut"] as const)("after %s, every partner can apply on their own", async (decision) => {
    const admin = await adminUser();
    const { founder, partners } = await teamOf(2);
    const appId = await submitAs(founder);
    await decide(admin, appId, decision, decision === "approve" ? "" : "not this time", "reviewed");
    for (const p of partners) {
      expect(await t.getMyTeam(p.id)).toBeNull();
      const pp = p as U & { token: string };
      expect((await submitApplication(pp, projectInput, pp.token, null)).ok).toBe(true);
    }
    // An admitted founder stays bound by their application; a cut founder may reapply.
    expect((await submitApplication(founder, projectInput, founder.token, null)).ok).toBe(decision === "reject_cut");
  });

  it("after being kicked, a partner can apply right away", async () => {
    const { founder, partners } = await teamOf(1);
    await t.kickPartner(founder, partners[0].id);
    const p = partners[0] as U & { token: string };
    expect((await submitApplication(p, projectInput, p.token, null)).ok).toBe(true);
  });
});

describe("Deleting a pending team application", () => {
  it("dissolves the team, releases partners and stops the link", async () => {
    const { founder, partners, token } = await teamOf(2);
    await submitAs(founder);
    expect(await deleteApplication(founder)).toEqual({ ok: true });
    expect(await t.inspectInvite(token, null)).toEqual({ ok: false, reason: "invalid" });
    for (const p of partners) {
      expect(await t.getMyTeam(p.id)).toBeNull();
      const pp = p as U & { token: string };
      expect((await submitApplication(pp, projectInput, pp.token, null)).ok).toBe(true);
    }
  });

  it("reopens the team when the deleted application was a resubmission", async () => {
    const admin = await adminUser();
    const { founder, partners, teamId } = await teamOf(1);
    const first = await submitAs(founder);
    await decide(admin, first, "reject_malformed", "fix it");
    await submitAs(founder);
    expect(await deleteApplication(founder)).toEqual({ ok: true });
    const [team] = await db().select().from(teams).where(eq(teams.id, teamId));
    expect(team).toMatchObject({ lockedAt: null, dissolvedAt: null });
    expect((await t.getMyTeam(partners[0].id))?.role).toBe("partner");
  });
});

describe("Application detail view (admin)", () => {
  it("lists the submitted team with the founder marked", async () => {
    const { founder, partners } = await teamOf(2);
    const appId = await submitAs(founder);
    const d = await getApplicationDetail(appId);
    expect(d?.members[appId]).toEqual([
      { userId: founder.id, role: "founder", name: `Name ${founder.hcId}` },
      ...partners
        .map((p) => ({ userId: p.id, role: "partner", name: `Name ${p.hcId}` }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    ]);
  });

  it("keeps each version's team across a resubmission", async () => {
    const admin = await adminUser();
    const { founder, partners } = await teamOf(2);
    const first = await submitAs(founder);
    await decide(admin, first, "reject_malformed", "who is on this team?");
    await t.kickPartner(founder, partners[0].id);
    const second = await submitAs(founder);
    const d = await getApplicationDetail(second);
    expect(d?.history.map((h) => h.id)).toEqual([first]);
    expect(d?.members[second].map((m) => m.userId).sort()).toEqual([founder.id, partners[1].id].sort());
    expect(d?.members[first].map((m) => m.userId).sort()).toEqual([founder.id, ...partners.map((p) => p.id)].sort());
  });
});

describe("Fraud bans and teams", () => {
  it("releases partners, and the banned founder can't form or join a team", async () => {
    const admin = await adminUser();
    const { founder, partners } = await teamOf(1);
    const appId = await submitAs(founder);
    await decide(admin, appId, "reject_fraud", "", "faked hours");
    expect(await t.getMyTeam(partners[0].id)).toBeNull();
    expect(await t.formTeam(founder)).toEqual({ ok: false, reason: "has_application" });

    const other = await teamOf(0);
    const token = (await t.getMyTeam(other.founder.id))?.team.inviteToken;
    expect(token).toBeTruthy();
    expect(await t.joinTeam(founder, token!)).toEqual({ ok: false, reason: "banned" });
  });

  it("lets a founder whose application was cut form a new team", async () => {
    const admin = await adminUser();
    const { founder } = await teamOf(1);
    const appId = await submitAs(founder);
    await decide(admin, appId, "reject_cut", "not this time", "too thin");
    expect((await t.formTeam(founder)).ok).toBe(true);
  });
});

