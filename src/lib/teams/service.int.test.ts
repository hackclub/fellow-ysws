import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, db } from "@/db";
import { applications, CREDITED_SECONDS, teams } from "@/db/schema";
import { inviteTokenHash } from "@/lib/crypto";
import { jar } from "../../../test/cookie-jar";
import { resetDb } from "../../../test/db";
import { makeUser } from "../../../test/factories";

vi.mock("next/headers", async () => (await import("../../../test/cookie-jar")).nextHeadersMock());
const t = await import("./service");

beforeEach(async () => {
  await resetDb();
  jar.clear();
});
afterAll(closeDb);

async function founderWithTeam() {
  const founder = await makeUser();
  const r = await t.formTeam(founder);
  if (!r.ok) throw new Error(r.reason);
  return { founder, team: r.team, token: r.team.inviteToken! };
}

async function insertApplication(userId: string, status: "submitted" | "rejected_malformed" = "submitted") {
  const id = randomUUID();
  await db().insert(applications).values({
    id,
    userId,
    kind: "project",
    contentEnc: "x",
    hackatimeSecondsSnapshot: 9000,
    creditedSeconds: CREDITED_SECONDS,
  });
  if (status !== "submitted") {
    await db()
      .update(applications)
      .set({ status, noteEnc: "x", decidedAt: new Date(), decidedByUserId: userId })
      .where(eq(applications.id, id));
  }
  return id;
}

async function lockTeam(teamId: string) {
  await db().update(teams).set({ lockedAt: new Date() }).where(eq(teams.id, teamId));
}

describe("Founder forms a team", () => {
  it("creates a team with the founder as its only member and an invite link", async () => {
    const { founder, team, token } = await founderWithTeam();
    expect(team.members).toEqual([{ userId: founder.id, role: "founder", name: `Name ${founder.hcId}` }]);
    expect(team.open).toBe(true);
    expect(team.partnerSpotsLeft).toBe(3);
    expect(token).toMatch(/^[\w-]{40,}$/);
    // Only the hash and ciphertext are stored.
    const [row] = await db().select().from(teams);
    expect(row.inviteTokenHash).toBe(inviteTokenHash(token));
    expect(row.inviteTokenEnc).not.toContain(token);
  });

  it("returns the same team when asked twice", async () => {
    const { founder, team } = await founderWithTeam();
    const again = await t.formTeam(founder);
    expect(again.ok && again.team.id).toBe(team.id);
  });

  it("refuses users with a live application or on another team", async () => {
    const applicant = await makeUser();
    await insertApplication(applicant.id);
    expect(await t.formTeam(applicant)).toEqual({ ok: false, reason: "has_application" });

    const { token } = await founderWithTeam();
    const partner = await makeUser();
    expect((await t.joinTeam(partner, token)).ok).toBe(true);
    expect(await t.formTeam(partner)).toEqual({ ok: false, reason: "on_team" });
  });

  it("lets a user whose application needs changes form a team", async () => {
    const u = await makeUser();
    await insertApplication(u.id, "rejected_malformed");
    expect((await t.formTeam(u)).ok).toBe(true);
  });
});

describe("Founder replaces the invite link", () => {
  it("issues a new link and the old one stops working", async () => {
    const { founder, team, token } = await founderWithTeam();
    const r = await t.replaceInvite(founder);
    expect(r.ok).toBe(true);
    const fresh = r.ok ? r.team.inviteToken! : "";
    expect(fresh).not.toBe(token);
    expect(r.ok && r.team.version).toBe(team.version + 1);
    const partner = await makeUser();
    expect(await t.joinTeam(partner, token)).toEqual({ ok: false, reason: "invalid" });
    expect((await t.joinTeam(partner, fresh)).ok).toBe(true);
  });
});

describe("Joining through the invite link", () => {
  it("adds an eligible user as a partner and shows the founder's name first", async () => {
    const { founder, token } = await founderWithTeam();
    const partner = await makeUser();
    expect(await t.inspectInvite(token, partner.id)).toMatchObject({
      ok: true,
      founderName: `Name ${founder.hcId}`,
      partnerSpotsLeft: 3,
    });
    expect((await t.joinTeam(partner, token)).ok).toBe(true);
    const mine = await t.getMyTeam(partner.id);
    expect(mine?.role).toBe("partner");
    expect(mine?.team.inviteToken).toBeNull(); // only the founder sees the link
    expect(mine?.team.members.map((m) => m.role)).toEqual(["founder", "partner"]);
  });

  it("tells the founder it's their own team", async () => {
    const { founder, token } = await founderWithTeam();
    expect(await t.joinTeam(founder, token)).toEqual({ ok: false, reason: "own_team" });
  });

  it("refuses a user who already has their own application, in any status", async () => {
    const { token } = await founderWithTeam();
    for (const status of ["submitted", "rejected_malformed"] as const) {
      const u = await makeUser();
      await insertApplication(u.id, status);
      expect(await t.joinTeam(u, token)).toEqual({ ok: false, reason: "has_application" });
    }
  });

  it("refuses the founder of another open team", async () => {
    const { token } = await founderWithTeam();
    const { founder: other } = await founderWithTeam();
    expect(await t.joinTeam(other, token)).toEqual({ ok: false, reason: "founds_other_team" });
  });

  it("refuses a partner already on another team, and an existing member", async () => {
    const a = await founderWithTeam();
    const b = await founderWithTeam();
    const partner = await makeUser();
    await t.joinTeam(partner, a.token);
    expect(await t.joinTeam(partner, b.token)).toEqual({ ok: false, reason: "on_other_team" });
    expect(await t.joinTeam(partner, a.token)).toEqual({ ok: false, reason: "already_member" });
  });
});

describe("Invite link validity", () => {
  it("rejects unknown links", async () => {
    const u = await makeUser();
    expect(await t.inspectInvite("nope", u.id)).toEqual({ ok: false, reason: "invalid" });
    expect(await t.inspectInvite("", null)).toEqual({ ok: false, reason: "invalid" });
  });

  it("says the team already applied once it's locked", async () => {
    const { team, token } = await founderWithTeam();
    await lockTeam(team.id);
    const u = await makeUser();
    expect(await t.inspectInvite(token, null)).toEqual({ ok: false, reason: "applied" });
    expect(await t.joinTeam(u, token)).toEqual({ ok: false, reason: "applied" });
  });
});

describe("Team size limit", () => {
  it("refuses a fourth partner", async () => {
    const { token } = await founderWithTeam();
    for (let i = 0; i < 3; i++) expect((await t.joinTeam(await makeUser(), token)).ok).toBe(true);
    expect(await t.inspectInvite(token, null)).toEqual({ ok: false, reason: "full" });
    expect(await t.joinTeam(await makeUser(), token)).toEqual({ ok: false, reason: "full" });
  });

  it("lets exactly one of two simultaneous joiners take the last spot", async () => {
    const { founder, token } = await founderWithTeam();
    await t.joinTeam(await makeUser(), token);
    await t.joinTeam(await makeUser(), token);
    const [x, y] = [await makeUser(), await makeUser()];
    const results = await Promise.all([t.joinTeam(x, token), t.joinTeam(y, token)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, reason: "full" }]);
    expect((await t.getMyTeam(founder.id))?.team.members).toHaveLength(4);
  });
});

describe("Founder kicks partners", () => {
  it("removes the partner, replaces the link, and the old link no longer works for them", async () => {
    const { founder, token } = await founderWithTeam();
    const partner = await makeUser();
    await t.joinTeam(partner, token);
    const r = await t.kickPartner(founder, partner.id);
    expect(r.ok).toBe(true);
    expect(r.ok && r.team.members.map((m) => m.userId)).toEqual([founder.id]);
    expect(r.ok && r.team.inviteToken).not.toBe(token);
    expect(await t.getMyTeam(partner.id)).toBeNull();
    expect(await t.joinTeam(partner, token)).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuses to remove the founder or a non-member", async () => {
    const { founder } = await founderWithTeam();
    expect(await t.kickPartner(founder, founder.id)).toEqual({ ok: false, reason: "is_founder" });
    expect(await t.kickPartner(founder, (await makeUser()).id)).toEqual({ ok: false, reason: "not_member" });
  });

  it("refuses once the team is locked, and non-founders can't kick", async () => {
    const { founder, team, token } = await founderWithTeam();
    const partner = await makeUser();
    await t.joinTeam(partner, token);
    expect(await t.kickPartner(partner, founder.id)).toEqual({ ok: false, reason: "no_team" });
    await lockTeam(team.id);
    expect(await t.kickPartner(founder, partner.id)).toEqual({ ok: false, reason: "locked" });
  });
});

describe("Partners leave", () => {
  it("lets a partner leave an open team", async () => {
    const { founder, token } = await founderWithTeam();
    const partner = await makeUser();
    await t.joinTeam(partner, token);
    expect(await t.leaveTeam(partner)).toEqual({ ok: true });
    expect((await t.getMyTeam(founder.id))?.team.members).toHaveLength(1);
    expect(await t.getMyTeam(partner.id)).toBeNull();
  });

  it("refuses to let a partner leave a locked team", async () => {
    const { team, token } = await founderWithTeam();
    const partner = await makeUser();
    await t.joinTeam(partner, token);
    await lockTeam(team.id);
    expect(await t.leaveTeam(partner)).toEqual({ ok: false, reason: "locked" });
  });
});

describe("Dissolving a team", () => {
  it("releases everyone and stops the link", async () => {
    const { founder, token } = await founderWithTeam();
    const partner = await makeUser();
    await t.joinTeam(partner, token);
    expect(await t.dissolveTeam(founder)).toEqual({ ok: true });
    expect(await t.getMyTeam(founder.id)).toBeNull();
    expect(await t.getMyTeam(partner.id)).toBeNull();
    expect(await t.inspectInvite(token, null)).toEqual({ ok: false, reason: "invalid" });
    // The partner is free to found their own team now.
    expect((await t.formTeam(partner)).ok).toBe(true);
  });

  it("refuses when an application uses the team", async () => {
    const { founder, team } = await founderWithTeam();
    const appId = await insertApplication(founder.id, "rejected_malformed");
    await db().update(applications).set({ teamId: team.id }).where(eq(applications.id, appId));
    expect(await t.dissolveTeam(founder)).toEqual({ ok: false, reason: "has_application" });
  });
});
