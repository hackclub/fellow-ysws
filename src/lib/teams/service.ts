import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, type Db } from "@/db";
import { applicationMembers, applications, programBans, TEAM_MAX_MEMBERS, teamMembers, teams, users } from "@/db/schema";
import { decrypt, encrypt, inviteTokenHash, randomToken } from "@/lib/crypto";
import { piiBinding, type UserPii } from "@/lib/auth/session";
import { lockUser, type Tx } from "@/lib/locks";

// Team lifecycle (see openspec/changes/team-applications/design.md):
//   open (locked_at NULL) --submit--> locked --"Needs changes"--> open again
//   locked --approved / not accepted--> every member released
//   open, or pending delete --dissolve--> dissolved, every member released
// Every transition locks the team row (after the acting user's lock) and bumps `version`.

export type TeamRole = "founder" | "partner";
export type Member = { userId: string; role: TeamRole; name: string };
export type TeamView = {
  id: string;
  version: number;
  open: boolean;
  members: Member[];
  partnerSpotsLeft: number;
  /** Only filled in for the founder. */
  inviteToken: string | null;
};

type TeamRow = typeof teams.$inferSelect;
type Conn = Db | Tx;

const tokenBinding = (teamId: string) => ({ table: "teams", column: "invite_token_enc", rowId: teamId });

function isOpen(t: Pick<TeamRow, "lockedAt" | "dissolvedAt">) {
  return t.lockedAt === null && t.dissolvedAt === null;
}

function newInvite(teamId: string) {
  const token = randomToken();
  return { token, inviteTokenHash: inviteTokenHash(token), inviteTokenEnc: encrypt(token, tokenBinding(teamId)) };
}

/** Locks the team row for the rest of the transaction. Always take the user lock first. */
async function lockTeam(tx: Tx, teamId: string): Promise<TeamRow | undefined> {
  const [row] = await tx.select().from(teams).where(eq(teams.id, teamId)).for("update");
  return row;
}

async function bump(tx: Tx, teamId: string, set: Partial<typeof teams.$inferInsert> = {}) {
  await tx
    .update(teams)
    .set({ ...set, version: sql`${teams.version} + 1` })
    .where(eq(teams.id, teamId));
}

async function releaseAll(tx: Tx, teamId: string) {
  await tx
    .update(teamMembers)
    .set({ releasedAt: new Date() })
    .where(and(eq(teamMembers.teamId, teamId), isNull(teamMembers.releasedAt)));
}

async function activeMembers(conn: Conn, teamId: string) {
  return conn
    .select({ userId: teamMembers.userId, role: teamMembers.role })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), isNull(teamMembers.releasedAt)))
    .orderBy(asc(teamMembers.joinedAt), asc(teamMembers.id));
}

/** The user's active membership, if any. */
async function membershipOf(conn: Conn, userId: string) {
  const [row] = await conn
    .select({ teamId: teamMembers.teamId, role: teamMembers.role })
    .from(teamMembers)
    .where(and(eq(teamMembers.userId, userId), isNull(teamMembers.releasedAt)))
    .limit(1);
  return row;
}

/** The user's own live application (as its submitter), if any. */
async function isBannedFromProgram(conn: Conn, userId: string): Promise<boolean> {
  const [row] = await conn.select({ id: programBans.userId }).from(programBans).where(eq(programBans.userId, userId)).limit(1);
  return !!row;
}

async function ownLiveApplication(conn: Conn, userId: string) {
  const [row] = await conn
    .select({ id: applications.id, status: applications.status })
    .from(applications)
    .where(and(eq(applications.userId, userId), isNull(applications.supersededById)))
    .limit(1);
  return row;
}

/** Decrypted display names for a set of users. */
export async function namesOf(conn: Conn, userIds: string[]): Promise<Map<string, string>> {
  if (!userIds.length) return new Map();
  const rows = await conn.select({ id: users.id, piiEnc: users.piiEnc }).from(users).where(inArray(users.id, userIds));
  return new Map(
    rows.map((r) => {
      const pii = decrypt<UserPii>(r.piiEnc, piiBinding(r.id));
      return [r.id, pii.name ?? pii.hcId];
    }),
  );
}

async function toView(conn: Conn, team: TeamRow, viewerId: string): Promise<TeamView> {
  const rows = await activeMembers(conn, team.id);
  const names = await namesOf(
    conn,
    rows.map((r) => r.userId),
  );
  return {
    id: team.id,
    version: team.version,
    open: isOpen(team),
    members: rows.map((r) => ({ ...r, name: names.get(r.userId) ?? "(no name)" })),
    partnerSpotsLeft: Math.max(0, TEAM_MAX_MEMBERS - rows.length),
    inviteToken: team.founderUserId === viewerId ? decrypt<string>(team.inviteTokenEnc, tokenBinding(team.id)) : null,
  };
}

/** The team the user is currently active on (as founder or partner), with their role. */
export async function getMyTeam(userId: string): Promise<{ role: TeamRole; team: TeamView } | null> {
  const m = await membershipOf(db(), userId);
  if (!m) return null;
  const team = await db().query.teams.findFirst({ where: eq(teams.id, m.teamId) });
  if (!team) return null;
  return { role: m.role, team: await toView(db(), team, userId) };
}

/** Partner check used by submit and the apply page: partners on an active team can't apply. */
export async function isTiedPartner(conn: Conn, userId: string): Promise<boolean> {
  return (await membershipOf(conn, userId))?.role === "partner";
}

// ---------------------------------------------------------------------------
// Founder actions

export type FormResult = { ok: true; team: TeamView } | { ok: false; reason: "has_application" | "on_team" };

/** Creates a team with the user as founder. Returns their existing open team if they already have one. */
export async function formTeam(user: { id: string }): Promise<FormResult> {
  return db().transaction(async (tx) => {
    await lockUser(tx, user.id);
    const m = await membershipOf(tx, user.id);
    if (m?.role === "partner") return { ok: false, reason: "on_team" } as const;
    if (m?.role === "founder") {
      const existing = await lockTeam(tx, m.teamId);
      if (existing && !isOpen(existing)) return { ok: false, reason: "has_application" } as const;
      if (existing) return { ok: true, team: await toView(tx, existing, user.id) } as const;
    }
    const live = await ownLiveApplication(tx, user.id);
    // After "Needs changes" or a cut, a founder may form a team for their next submission.
    if (live && live.status !== "rejected_malformed" && live.status !== "rejected_cut") {
      return { ok: false, reason: "has_application" } as const;
    }
    if (await isBannedFromProgram(tx, user.id)) return { ok: false, reason: "has_application" } as const;

    const id = randomUUID();
    const { inviteTokenHash: hash, inviteTokenEnc } = newInvite(id);
    await tx.insert(teams).values({ id, founderUserId: user.id, inviteTokenHash: hash, inviteTokenEnc });
    await tx.insert(teamMembers).values({ teamId: id, userId: user.id, role: "founder" });
    // A solo "Needs changes" application gets this team when it's resubmitted.
    const [row] = await tx.select().from(teams).where(eq(teams.id, id));
    return { ok: true, team: await toView(tx, row, user.id) } as const;
  });
}

export type FounderActionResult =
  | { ok: true; team: TeamView }
  | { ok: false; reason: "no_team" | "locked" | "not_member" | "is_founder" | "has_application" };

/** Runs `fn` on the founder's own team, locked and open. */
async function asFounder(
  userId: string,
  fn: (tx: Tx, team: TeamRow) => Promise<FounderActionResult | void>,
): Promise<FounderActionResult> {
  return db().transaction(async (tx) => {
    await lockUser(tx, userId);
    const m = await membershipOf(tx, userId);
    if (m?.role !== "founder") return { ok: false, reason: "no_team" } as const;
    const team = await lockTeam(tx, m.teamId);
    if (!team || team.dissolvedAt) return { ok: false, reason: "no_team" } as const;
    if (!isOpen(team)) return { ok: false, reason: "locked" } as const;
    const out = await fn(tx, team);
    if (out) return out;
    const [fresh] = await tx.select().from(teams).where(eq(teams.id, team.id));
    return { ok: true, team: await toView(tx, fresh, userId) } as const;
  });
}

/** Replaces the invite link; the previous one stops working at once. */
export async function replaceInvite(user: { id: string }): Promise<FounderActionResult> {
  return asFounder(user.id, async (tx, team) => {
    const { inviteTokenHash: hash, inviteTokenEnc } = newInvite(team.id);
    await bump(tx, team.id, { inviteTokenHash: hash, inviteTokenEnc });
  });
}

/** Removes a partner and replaces the invite link so they can't come back with the old one. */
export async function kickPartner(user: { id: string }, partnerUserId: string): Promise<FounderActionResult> {
  return asFounder(user.id, async (tx, team) => {
    if (partnerUserId === user.id) return { ok: false, reason: "is_founder" };
    const released = await tx
      .update(teamMembers)
      .set({ releasedAt: new Date() })
      .where(
        and(
          eq(teamMembers.teamId, team.id),
          eq(teamMembers.userId, partnerUserId),
          eq(teamMembers.role, "partner"),
          isNull(teamMembers.releasedAt),
        ),
      )
      .returning({ id: teamMembers.id });
    if (!released.length) return { ok: false, reason: "not_member" };
    const { inviteTokenHash: hash, inviteTokenEnc } = newInvite(team.id);
    await bump(tx, team.id, { inviteTokenHash: hash, inviteTokenEnc });
  });
}

export type DissolveResult = { ok: true } | { ok: false; reason: "no_team" | "locked" | "has_application" };

/** Dissolves an open team that no application uses yet, releasing everyone. */
export async function dissolveTeam(user: { id: string }): Promise<DissolveResult> {
  const r = await asFounder(user.id, async (tx, team) => {
    const [used] = await tx
      .select({ id: applications.id })
      .from(applications)
      .where(eq(applications.teamId, team.id))
      .limit(1);
    if (used) return { ok: false, reason: "has_application" };
    await bump(tx, team.id, { dissolvedAt: new Date() });
    await releaseAll(tx, team.id);
  });
  if (r.ok) return { ok: true };
  return { ok: false, reason: r.reason === "locked" || r.reason === "has_application" ? r.reason : "no_team" };
}

// ---------------------------------------------------------------------------
// Partner actions

export type LeaveResult = { ok: true } | { ok: false; reason: "not_partner" | "locked" };

export async function leaveTeam(user: { id: string }): Promise<LeaveResult> {
  return db().transaction(async (tx) => {
    await lockUser(tx, user.id);
    const m = await membershipOf(tx, user.id);
    if (m?.role !== "partner") return { ok: false, reason: "not_partner" } as const;
    const team = await lockTeam(tx, m.teamId);
    if (!team || !isOpen(team)) return { ok: false, reason: "locked" } as const;
    await tx
      .update(teamMembers)
      .set({ releasedAt: new Date() })
      .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, user.id), isNull(teamMembers.releasedAt)));
    await bump(tx, team.id);
    return { ok: true } as const;
  });
}

export type InviteRefusal =
  | "invalid" // unknown, replaced, or the team was dissolved
  | "banned"
  | "full"
  | "applied"
  | "own_team"
  | "already_member"
  | "has_application"
  | "founds_other_team"
  | "on_other_team";

export type InviteCheck =
  | { ok: true; teamId: string; founderName: string; partnerSpotsLeft: number }
  | { ok: false; reason: InviteRefusal };

async function checkInvite(conn: Conn, token: string, viewerId: string | null): Promise<InviteCheck> {
  const team = token
    ? await conn.query.teams.findFirst({ where: eq(teams.inviteTokenHash, inviteTokenHash(token)) })
    : undefined;
  if (!team || team.dissolvedAt) return { ok: false, reason: "invalid" };
  if (viewerId === team.founderUserId) return { ok: false, reason: "own_team" };
  if (viewerId) {
    const m = await membershipOf(conn, viewerId);
    if (m?.teamId === team.id) return { ok: false, reason: "already_member" };
  }
  if (team.lockedAt) return { ok: false, reason: "applied" };
  if (viewerId) {
    if (await isBannedFromProgram(conn, viewerId)) return { ok: false, reason: "banned" };
    const live = await ownLiveApplication(conn, viewerId);
    // Someone whose last application was cut may join a team; anything else live blocks it.
    if (live && live.status !== "rejected_cut") return { ok: false, reason: "has_application" };
    const m = await membershipOf(conn, viewerId);
    if (m) return { ok: false, reason: m.role === "founder" ? "founds_other_team" : "on_other_team" };
  }
  const [{ n }] = await conn
    .select({ n: count() })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, team.id), isNull(teamMembers.releasedAt)));
  if (n >= TEAM_MAX_MEMBERS) return { ok: false, reason: "full" };
  const names = await namesOf(conn, [team.founderUserId]);
  return {
    ok: true,
    teamId: team.id,
    founderName: names.get(team.founderUserId) ?? "(no name)",
    partnerSpotsLeft: TEAM_MAX_MEMBERS - n,
  };
}

/** What the join page shows for a link, for a signed-in viewer or (null) a visitor. */
export async function inspectInvite(token: string, viewerId: string | null): Promise<InviteCheck> {
  return checkInvite(db(), token, viewerId);
}

export type JoinResult = { ok: true; teamId: string } | { ok: false; reason: InviteRefusal };

/** Adds the user as a partner, re-checking every rule under the user and team locks. */
export async function joinTeam(user: { id: string }, token: string): Promise<JoinResult> {
  const target = token
    ? await db().query.teams.findFirst({ where: eq(teams.inviteTokenHash, inviteTokenHash(token)), columns: { id: true } })
    : undefined;
  if (!target) return { ok: false, reason: "invalid" };
  try {
    return await db().transaction(async (tx) => {
      await lockUser(tx, user.id);
      await lockTeam(tx, target.id);
      const check = await checkInvite(tx, token, user.id);
      if (!check.ok) return check;
      await tx.insert(teamMembers).values({ teamId: target.id, userId: user.id, role: "partner" });
      await bump(tx, target.id);
      return { ok: true, teamId: target.id } as const;
    });
  } catch (e) {
    // Backstop for the one-active-team index; the checks above normally catch this first.
    const err = e as { cause?: { constraint?: string }; constraint?: string };
    if ((err.cause?.constraint ?? err.constraint) === "team_members_one_active_team") {
      return { ok: false, reason: "on_other_team" };
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Application lifecycle hooks (called inside the application and admin transactions)

export type SubmitTeam = { teamId: string | null; members: { userId: string; role: TeamRole }[] };

/**
 * Locks the founder's open team for submission and checks the form's team version.
 * Returns the members to record on the application, or "stale" if the team changed.
 */
export async function teamForSubmit(
  tx: Tx,
  founderId: string,
  postedVersion: number | null,
): Promise<SubmitTeam | "stale"> {
  const m = await membershipOf(tx, founderId);
  if (m?.role !== "founder") {
    // The form showed a team that has since gone away.
    if (postedVersion !== null) return "stale";
    return { teamId: null, members: [{ userId: founderId, role: "founder" }] };
  }
  const team = await lockTeam(tx, m.teamId);
  if (!team || !isOpen(team) || postedVersion !== team.version) return "stale";
  return { teamId: team.id, members: await activeMembers(tx, team.id) };
}

/** Records who's on the application and locks the team. */
export async function lockForApplication(tx: Tx, applicationId: string, submit: SubmitTeam) {
  await tx.insert(applicationMembers).values(submit.members.map((m) => ({ applicationId, ...m })));
  if (submit.teamId) await bump(tx, submit.teamId, { lockedAt: new Date() });
}

/** Applies a review decision to the application's team. */
export async function onDecision(
  tx: Tx,
  teamId: string | null,
  status: "approved" | "rejected_cut" | "rejected_malformed" | "rejected_fraud",
) {
  if (!teamId) return;
  await lockTeam(tx, teamId);
  if (status === "rejected_malformed") {
    await bump(tx, teamId, { lockedAt: null });
  } else {
    await releaseAll(tx, teamId);
    await bump(tx, teamId);
  }
}

/**
 * Applies deleting a pending application to its team. If it was a resubmission, the team goes
 * back to the "Needs changes" application it replaced and reopens; otherwise it is dissolved.
 */
export async function onPendingDelete(tx: Tx, teamId: string | null, backToNeedsChanges: boolean) {
  if (!teamId) return;
  await lockTeam(tx, teamId);
  if (backToNeedsChanges) {
    await bump(tx, teamId, { lockedAt: null });
  } else {
    await bump(tx, teamId, { dissolvedAt: new Date() });
    await releaseAll(tx, teamId);
  }
}

// ---------------------------------------------------------------------------
// Reads for status pages and the admin view

/** Members recorded on an application at submission, founder first. */
export async function membersOfApplication(applicationId: string): Promise<Member[]> {
  const rows = await db()
    .select({ userId: applicationMembers.userId, role: applicationMembers.role })
    .from(applicationMembers)
    .where(eq(applicationMembers.applicationId, applicationId));
  const names = await namesOf(
    db(),
    rows.map((r) => r.userId),
  );
  return rows
    .map((r) => ({ ...r, name: names.get(r.userId) ?? "(no name)" }))
    .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "founder" ? -1 : 1));
}

/** The live application on a team, if it has one. */
export async function liveApplicationIdOfTeam(teamId: string): Promise<string | null> {
  const [row] = await db()
    .select({ id: applications.id })
    .from(applications)
    .where(and(eq(applications.teamId, teamId), isNull(applications.supersededById)))
    .orderBy(desc(applications.createdAt))
    .limit(1);
  return row?.id ?? null;
}
