import { and, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, db } from "@/db";
import { applicationMembers, applications, programBans, teamMembers, teams } from "@/db/schema";
import { decrypt } from "@/lib/crypto";
import type { PartnerProjectInput } from "@/lib/applications/shared";
import type { FeeMode } from "./service";
import { jar } from "../../../test/cookie-jar";
import { resetDb } from "../../../test/db";
import { aidInput, makeUser, projectInput, signInAsAdmin } from "../../../test/factories";
import { fake, installFakeProviders } from "../../../test/fake-providers";

vi.mock("next/headers", async () => (await import("../../../test/cookie-jar")).nextHeadersMock());
const t = await import("./service");
const { savePartnerProjectFromForm } = await import("./partner-project");
const { submitApplication } = await import("@/lib/applications/service");
const { decide, getApplicationDetail } = await import("@/lib/admin/service");
const { getApplicantState } = await import("@/lib/applications/service");

beforeEach(async () => {
  await resetDb();
  jar.clear();
  fake.reset();
  installFakeProviders();
});
afterAll(closeDb);

type U = { id: string; hcId: string; token: string };

let nextHackatimeId = 1000;

/** A user with their own Hackatime account and the given projects. */
async function person(projects = [{ name: "big-project", total_seconds: 14 * 3600 }]): Promise<U> {
  const u = await makeUser();
  const token = `tok-${u.id}`;
  fake.tokens.set(token, { sub: u.hcId });
  fake.projects.set(u.hcId, projects);
  fake.hackatimeIds.set(u.hcId, nextHackatimeId++);
  return { ...u, token };
}

const partnerInput = (over: PartnerProjectInput = {}): PartnerProjectInput => ({
  hackatimeProject: "side-thing",
  codeUrl: "https://github.com/someone/side-thing",
  playableUrl: "https://side-thing.example.com",
  description: "a smaller shipped project",
  heardFrom: "my teammate",
  ...over,
});

async function teamOf(partners: number, mode: FeeMode = "each_pays") {
  const founder = await person();
  const formed = await t.formTeam(founder);
  if (!formed.ok) throw new Error(formed.reason);
  const ps: U[] = [];
  for (let i = 0; i < partners; i++) {
    const p = await person([{ name: "side-thing", total_seconds: 3 * 3600 + 120 }]);
    expect((await t.joinTeam(p, formed.team.inviteToken!)).ok).toBe(true);
    ps.push(p);
  }
  if (mode === "each_pays") expect((await t.setFeeMode(founder, "each_pays")).ok).toBe(true);
  return { founder, partners: ps, teamId: formed.team.id };
}

const version = async (userId: string) => (await t.getMyTeam(userId))!.team.version;

const save = (p: U, over: PartnerProjectInput = {}) => savePartnerProjectFromForm(p, partnerInput(over), p.token);

async function submit(founder: U, input = projectInput) {
  return submitApplication(founder, input, founder.token, await version(founder.id));
}

describe("Founder chooses the fee mode", () => {
  it("defaults to founder pays", async () => {
    const founder = await person();
    const r = await t.formTeam(founder);
    expect(r.ok && r.team.feeMode).toBe("founder_pays");
  });

  it("switching is a team change; switching to the same mode isn't", async () => {
    const { founder } = await teamOf(1, "founder_pays");
    const v0 = await version(founder.id);
    const r = await t.setFeeMode(founder, "each_pays");
    expect(r.ok && r.team.feeMode).toBe("each_pays");
    expect(await version(founder.id)).toBe(v0 + 1);
    await t.setFeeMode(founder, "each_pays");
    expect(await version(founder.id)).toBe(v0 + 1);
  });

  it("only the founder of an open team can switch", async () => {
    const { founder, partners, teamId } = await teamOf(1, "founder_pays");
    expect(await t.setFeeMode(partners[0], "each_pays")).toEqual({ ok: false, reason: "no_team" });
    await db().update(teams).set({ lockedAt: new Date() }).where(eq(teams.id, teamId));
    expect(await t.setFeeMode(founder, "each_pays")).toEqual({ ok: false, reason: "locked" });
  });

  it("shows the mode on the invite page", async () => {
    const founder = await person();
    const formed = await t.formTeam(founder);
    if (!formed.ok) throw new Error();
    await t.setFeeMode(founder, "each_pays");
    const viewer = await person();
    const check = await t.inspectInvite(formed.team.inviteToken!, viewer.id);
    expect(check.ok && check.feeMode).toBe("each_pays");
  });
});

describe("Partner adds their own project", () => {
  it("saves the project with its hours, marks the partner ready, and bumps the version", async () => {
    const { founder, partners } = await teamOf(1);
    const v0 = await version(founder.id);
    expect(await save(partners[0])).toEqual({ ok: true });
    expect(await version(founder.id)).toBe(v0 + 1);
    expect((await t.getMyTeam(founder.id))!.team.readyPartnerIds).toEqual([partners[0].id]);
    const mine = await t.getMyPartnerProject(partners[0].id);
    expect(mine).toMatchObject({
      feeMode: "each_pays",
      open: true,
      project: { seconds: 3 * 3600 + 120, content: partnerInput() },
    });
  });

  it("never shows a partner's project content to the founder", async () => {
    const { founder, partners } = await teamOf(1);
    await save(partners[0], { description: "TOP-SECRET-DESCRIPTION" });
    expect(JSON.stringify(await t.getMyTeam(founder.id))).not.toContain("TOP-SECRET-DESCRIPTION");
  });

  it("refuses founders, non-members, founder-pays teams and locked teams", async () => {
    const { founder, partners, teamId } = await teamOf(1, "founder_pays");
    expect(await save(founder, { hackatimeProject: "big-project" })).toEqual({ ok: false, errors: { form: expect.stringMatching(/not a partner/) } });
    expect(await save(await person([{ name: "side-thing", total_seconds: 9000 }]))).toMatchObject({ ok: false });
    expect(await save(partners[0])).toEqual({ ok: false, errors: { form: expect.stringMatching(/covering your hours/) } });
    await t.setFeeMode(founder, "each_pays");
    await db().update(teams).set({ lockedAt: new Date() }).where(eq(teams.id, teamId));
    expect(await save(partners[0])).toEqual({ ok: false, errors: { form: expect.stringMatching(/already submitted/) } });
  });

  it("refuses projects under 2 hours and invalid links", async () => {
    const { partners } = await teamOf(1);
    fake.projects.set(partners[0].hcId, [{ name: "side-thing", total_seconds: 7199 }]);
    expect(await save(partners[0])).toMatchObject({ ok: false, errors: { hackatimeProject: /2\+ hours/ } });
    expect(await save(partners[0], { codeUrl: "https://example.com" })).toMatchObject({ ok: false, errors: { codeUrl: /github/ } });
  });

  it("needs a Hackatime token and a Hackatime account id", async () => {
    const { partners } = await teamOf(1);
    expect(await savePartnerProjectFromForm(partners[0], partnerInput(), null)).toMatchObject({
      ok: false,
      errors: { hackatimeProject: /reconnect/ },
    });
    fake.hackatimeIds.set(partners[0].hcId, null);
    expect(await save(partners[0])).toMatchObject({ ok: false, errors: { hackatimeProject: /hackatime account/ } });
    fake.hackatimeDown = true;
    expect(await save(partners[0])).toMatchObject({ ok: false, errors: { hackatimeProject: /unavailable/ } });
    expect((await t.getMyPartnerProject(partners[0].id))!.project).toBeNull();
  });

  it("keeps the saved project across mode switches", async () => {
    const { founder, partners } = await teamOf(1);
    await save(partners[0]);
    await t.setFeeMode(founder, "founder_pays");
    await t.setFeeMode(founder, "each_pays");
    expect((await t.getMyTeam(founder.id))!.team.readyPartnerIds).toEqual([partners[0].id]);
  });

  it("loses the draft when the partner leaves", async () => {
    const { partners } = await teamOf(1);
    await save(partners[0]);
    expect((await t.leaveTeam(partners[0])).ok).toBe(true);
    expect(await t.getMyPartnerProject(partners[0].id)).toBeNull();
  });
});

describe("Submitting in each-pays mode", () => {
  it("credits 2 hours to every project and freezes the partners' projects", async () => {
    const { founder, partners } = await teamOf(2);
    for (const p of partners) await save(p);
    const r = await submit(founder);
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    const [app] = await db().select().from(applications).where(eq(applications.id, r.id));
    expect(app).toMatchObject({ feeMode: "each_pays", creditedSeconds: 7200, hackatimeSecondsSnapshot: 14 * 3600 });
    const rows = await db().select().from(applicationMembers).where(eq(applicationMembers.applicationId, r.id));
    const founderRow = rows.find((m) => m.role === "founder")!;
    expect(founderRow.contentEnc).toBeNull();
    for (const p of partners) {
      const row = rows.find((m) => m.userId === p.id)!;
      expect(row).toMatchObject({ creditedSeconds: 7200, hackatimeSecondsSnapshot: 3 * 3600 + 120 });
      expect(decrypt(row.contentEnc!, t.memberContentBinding(r.id, p.id))).toEqual(partnerInput());
    }
  });

  it("refuses while a partner hasn't added their project", async () => {
    const { founder, partners } = await teamOf(2);
    await save(partners[0]);
    const r = await submit(founder);
    expect(r).toEqual({ ok: false, errors: { team: `Name ${partners[1].hcId} hasn't added their project yet` } });
    expect(await db().select().from(applications)).toHaveLength(0);
  });

  it("refuses when two people used the same Hackatime account", async () => {
    const { founder, partners } = await teamOf(1);
    fake.hackatimeIds.set(partners[0].hcId, fake.hackatimeIds.get(founder.hcId)!);
    await save(partners[0]);
    expect(await submit(founder)).toMatchObject({ ok: false, errors: { hackatimeProject: /their own hackatime account/ } });
  });

  it("allows members to share a code repository", async () => {
    const { founder, partners } = await teamOf(1);
    await save(partners[0], { codeUrl: projectInput.codeUrl });
    expect((await submit(founder)).ok).toBe(true);
  });

  it("only needs 2 hours on the founder's project", async () => {
    const { founder, partners } = await teamOf(3);
    fake.projects.set(founder.hcId, [{ name: "big-project", total_seconds: 2 * 3600 + 60 }]);
    for (const p of partners) await save(p);
    expect((await submit(founder)).ok).toBe(true);
  });

  it("refuses a submit whose form predates a partner's save", async () => {
    const { founder, partners } = await teamOf(1);
    await save(partners[0]);
    const stale = await version(founder.id);
    await save(partners[0], { description: "edited" });
    const r = await submitApplication(founder, projectInput, founder.token, stale);
    expect(r).toMatchObject({ ok: false, errors: { team: /changed/ } });
  });

  it("founder-pays is unchanged: 6 hours for a team of 3, partners' saved projects ignored", async () => {
    const { founder, partners } = await teamOf(2);
    for (const p of partners) await save(p);
    await t.setFeeMode(founder, "founder_pays");
    const r = await submit(founder);
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    const [app] = await db().select().from(applications).where(eq(applications.id, r.id));
    expect(app).toMatchObject({ feeMode: "founder_pays", creditedSeconds: 6 * 3600 });
    const frozen = await db()
      .select()
      .from(applicationMembers)
      .where(and(eq(applicationMembers.applicationId, r.id), eq(applicationMembers.role, "partner")));
    expect(frozen.every((m) => m.contentEnc === null)).toBe(true);
  });

  it("aid ignores the mode", async () => {
    const { founder } = await teamOf(1);
    const r = await submitApplication(founder, aidInput, null, await version(founder.id));
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    const [app] = await db().select().from(applications).where(eq(applications.id, r.id));
    expect(app).toMatchObject({ kind: "aid", feeMode: "founder_pays", creditedSeconds: null });
  });
});

describe("Needs changes round trip", () => {
  it("lets a partner edit their project and resubmits it, leaving the old application as submitted", async () => {
    const { founder, partners } = await teamOf(1);
    const p = partners[0];
    await save(p, { playableUrl: "https://broken.example.com" });
    const first = await submit(founder);
    if (!first.ok) throw new Error(JSON.stringify(first.errors));
    // Locked while pending.
    expect(await save(p)).toMatchObject({ ok: false, errors: { form: /already submitted/ } });

    await signInAsAdmin();
    expect((await decide(first.id, "reject_malformed", "fix your demo link")).ok).toBe(true);
    expect((await t.getMyPartnerProject(p.id))!.open).toBe(true);
    expect(await save(p, { playableUrl: "https://fixed.example.com" })).toEqual({ ok: true });

    const second = await submit(founder);
    if (!second.ok) throw new Error(JSON.stringify(second.errors));
    const frozen = async (appId: string) => {
      const [row] = await db()
        .select()
        .from(applicationMembers)
        .where(and(eq(applicationMembers.applicationId, appId), eq(applicationMembers.userId, p.id)));
      return decrypt<PartnerProjectInput>(row.contentEnc!, t.memberContentBinding(appId, p.id)).playableUrl;
    };
    expect(await frozen(first.id)).toBe("https://broken.example.com");
    expect(await frozen(second.id)).toBe("https://fixed.example.com");
    // The live draft row is still the partner's.
    const [draft] = await db().select().from(teamMembers).where(eq(teamMembers.userId, p.id));
    expect(draft.projectSavedAt).not.toBeNull();
  });
});

describe("Admin review of an each-pays application", () => {
  async function submittedTeam() {
    const { founder, partners } = await teamOf(2);
    for (const p of partners) await save(p);
    const r = await submit(founder);
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    await signInAsAdmin();
    return { founder, partners, id: r.id };
  }

  it("shows every partner's project with its own hours and Hackatime account", async () => {
    const { partners, id } = await submittedTeam();
    const d = await getApplicationDetail(id);
    expect(d?.app.feeMode).toBe("each_pays");
    expect(d?.projects[id]).toHaveLength(2);
    for (const p of partners) {
      expect(d?.projects[id]).toContainEqual(
        expect.objectContaining({
          userId: p.id,
          snapshotSeconds: 3 * 3600 + 120,
          creditedSeconds: 7200,
          hackatimeId: String(fake.hackatimeIds.get(p.hcId)),
          content: expect.objectContaining({ codeUrl: "https://github.com/someone/side-thing" }),
        }),
      );
    }
  });

  it("fraud rejects the whole team and bans only the chosen partner", async () => {
    const { founder, partners, id } = await submittedTeam();
    expect(await decide(id, "reject_fraud", "", "stolen repo", partners[0].id)).toEqual({ ok: true });
    const bans = await db().select().from(programBans);
    expect(bans.map((b) => b.userId)).toEqual([partners[0].id]);
    expect((await getApplicationDetail(id))?.bannedNames).toEqual([`Name ${partners[0].hcId}`]);
    expect(await getApplicantState(founder)).toMatchObject({ banned: false });
    expect(await getApplicantState(partners[1])).toMatchObject({ banned: false });
    expect(await getApplicantState(partners[0])).toMatchObject({ banned: true });
    const [app] = await db().select().from(applications).where(eq(applications.id, id));
    expect(app.status).toBe("rejected_fraud");
  });

  it("fraud bans the founder by default", async () => {
    const { founder, id } = await submittedTeam();
    expect(await decide(id, "reject_fraud", "", "faked hours")).toEqual({ ok: true });
    expect((await db().select().from(programBans)).map((b) => b.userId)).toEqual([founder.id]);
  });

  it("lets the founder start over when a partner was banned", async () => {
    const { founder, partners, id } = await submittedTeam();
    expect(await decide(id, "reject_fraud", "", "stolen repo", partners[0].id)).toEqual({ ok: true });
    expect(await getApplicantState(founder)).toMatchObject({ canSubmit: true, banned: false });

    // They can join someone else's team...
    const other = await person();
    const otherTeam = await t.formTeam(other);
    if (!otherTeam.ok) throw new Error();
    expect(await t.inspectInvite(otherTeam.team.inviteToken!, founder.id)).toMatchObject({ ok: true });

    // ...or form a new team of their own and resubmit, replacing the rejected application.
    const formed = await t.formTeam(founder);
    expect(formed.ok).toBe(true);
    const again = await submit(founder);
    if (!again.ok) throw new Error(JSON.stringify(again.errors));
    const [old] = await db().select().from(applications).where(eq(applications.id, id));
    expect(old).toMatchObject({ status: "rejected_fraud", supersededById: again.id });
    expect((await getApplicantState(founder)).live).toMatchObject({ id: again.id, status: "submitted" });
  });

  it("keeps a banned founder out of submitting, forming and joining", async () => {
    const { founder, id } = await submittedTeam();
    expect(await decide(id, "reject_fraud", "", "faked hours")).toEqual({ ok: true });
    expect(await getApplicantState(founder)).toMatchObject({ canSubmit: false, banned: true });
    expect(await submitApplication(founder, projectInput, founder.token, null)).toMatchObject({
      ok: false,
      errors: { form: /can't apply/ },
    });
    expect(await t.formTeam(founder)).toEqual({ ok: false, reason: "has_application" });
    const other = await person();
    const otherTeam = await t.formTeam(other);
    if (!otherTeam.ok) throw new Error();
    expect(await t.inspectInvite(otherTeam.team.inviteToken!, founder.id)).toEqual({ ok: false, reason: "banned" });
  });

  it("refuses to ban someone who isn't on the application, and writes nothing", async () => {
    const { id } = await submittedTeam();
    const outsider = await person();
    expect(await decide(id, "reject_fraud", "", "x", outsider.id)).toEqual({ ok: false, error: "bad_ban_target" });
    expect(await db().select().from(programBans)).toHaveLength(0);
    const [app] = await db().select().from(applications).where(eq(applications.id, id));
    expect(app.status).toBe("submitted");
  });
});
