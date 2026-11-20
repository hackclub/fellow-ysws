import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db, type Db } from "@/db";
import { applicationMembers, applications, programBans, TEAM_MAX_MEMBERS, teamMembers, teams, users } from "@/db/schema";
import { decrypt, encrypt, inviteTokenHash, randomToken } from "@/lib/crypto";
import { piiBinding, type UserPii } from "@/lib/auth/session";
import type { PartnerProjectContent } from "@/lib/applications/shared";
import { lockUser, type Tx } from "@/lib/locks";

// Team lifecycle (see openspec/changes/team-applications/design.md):
//   open (locked_at NULL) --submit--> locked --"Needs changes"--> open again
//   locked --approved / not accepted--> every member released
//   open, or pending delete --dissolve--> dissolved, every member released
// Every transition locks the team row (after the acting user's lock) and bumps `version`.

export type TeamRole = "founder" | "partner";
export type FeeMode = "founder_pays" | "each_pays";
export type Member = { userId: string; role: TeamRole; name: string };
export type TeamView = {
  id: string;
  version: number;
  open: boolean;
  members: Member[];
  partnerSpotsLeft: number;
  /** Who pays the project-path fee. */
  feeMode: FeeMode;
  /** Partners who have saved their own project (used in "each pays" mode). Never the content. */
  readyPartnerIds: string[];
  /** Only filled in for the founder. */
  inviteToken: string | null;
};

type TeamRow = typeof teams.$inferSelect;
type Conn = Db | Tx;

const tokenBinding = (teamId: string) => ({ table: "teams", column: "invite_token_enc", rowId: teamId });
const draftBinding = (memberRowId: number) => ({ table: "team_members", column: "project_enc", rowId: String(memberRowId) });
const draftHackatimeBinding = (memberRowId: number) => ({
  table: "team_members",
  column: "project_hackatime_id_enc",
  rowId: String(memberRowId),
});
/** Bindings for a partner's frozen project on `application_members` (composite key). */
export const memberContentBinding = (applicationId: string, userId: string) => ({
  table: "application_members",
  column: "content_enc",
  rowId: `${applicationId}:${userId}`,
});
export const memberHackatimeBinding = (applicationId: string, userId: string) => ({
  table: "application_members",
  column: "hackatime_id_enc",
  rowId: `${applicationId}:${userId}`,
});

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

/** Active members with their saved-project markers (and the row id the draft is bound to). */
async function activeMemberRows(conn: Conn, teamId: string) {
  return conn
    .select({
      id: teamMembers.id,
      userId: teamMembers.userId,
      role: teamMembers.role,
      projectEnc: teamMembers.projectEnc,
      projectSeconds: teamMembers.projectSeconds,
      projectHackatimeIdEnc: teamMembers.projectHackatimeIdEnc,
      projectSavedAt: teamMembers.projectSavedAt,
    })
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
  const rows = await activeMemberRows(conn, team.id);
  const names = await namesOf(
    conn,
    rows.map((r) => r.userId),
  );
  return {
    id: team.id,
    version: team.version,
    open: isOpen(team),
    members: rows.map((r) => ({ userId: r.userId, role: r.role, name: names.get(r.userId) ?? "(no name)" })),
    partnerSpotsLeft: Math.max(0, TEAM_MAX_MEMBERS - rows.length),
    feeMode: team.feeMode,
    readyPartnerIds: rows.filter((r) => r.role === "partner" && r.projectSavedAt).map((r) => r.userId),
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
    // After "Needs changes", a cut, or a fraud rejection that banned a partner (banned users are
    // refused just below), a founder may form a team for their next submission.
    if (live && !["rejected_malformed", "rejected_cut", "rejected_fraud"].includes(live.status)) {
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

/** Switches who pays the fee. Counts as a team change; partners' saved projects are kept. */
export async function setFeeMode(user: { id: string }, mode: FeeMode): Promise<FounderActionResult> {
  return asFounder(user.id, async (tx, team) => {
    if (team.feeMode !== mode) await bump(tx, team.id, { feeMode: mode });
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

export type PartnerProject = {
  content: PartnerProjectContent;
  seconds: number;
  savedAt: Date;
};

export type PartnerProjectView = {
  teamId: string;
  founderName: string;
  feeMode: FeeMode;
  open: boolean;
  project: PartnerProject | null;
};

/** The partner's own team and saved project, for their portal. Null unless they're an active partner. */
export async function getMyPartnerProject(userId: string): Promise<PartnerProjectView | null> {
  const [row] = await db()
    .select({ member: teamMembers, team: teams })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(and(eq(teamMembers.userId, userId), eq(teamMembers.role, "partner"), isNull(teamMembers.releasedAt)))
    .limit(1);
  if (!row) return null;
  const names = await namesOf(db(), [row.team.founderUserId]);
  const m = row.member;
  return {
    teamId: row.team.id,
    founderName: names.get(row.team.founderUserId) ?? "(no name)",
    feeMode: row.team.feeMode,
    open: isOpen(row.team),
    project:
      m.projectEnc && m.projectSeconds !== null && m.projectSavedAt
        ? { content: decrypt<PartnerProjectContent>(m.projectEnc, draftBinding(m.id)), seconds: m.projectSeconds, savedAt: m.projectSavedAt }
        : null,
  };
}

export type SaveProjectResult =
  | { ok: true }
  | { ok: false; reason: "not_partner" | "locked" | "founder_pays" };

/**
 * Saves a partner's own project with the hours and Hackatime account read in their session.
 * Callers validate the content and check the hours first. Counts as a team change.
 */
export async function savePartnerProject(
  user: { id: string },
  content: PartnerProjectContent,
  hours: { seconds: number; hackatimeId: string },
): Promise<SaveProjectResult> {
  return db().transaction(async (tx) => {
    await lockUser(tx, user.id);
    const [m] = await tx
      .select({ id: teamMembers.id, teamId: teamMembers.teamId, role: teamMembers.role })
      .from(teamMembers)
      .where(and(eq(teamMembers.userId, user.id), isNull(teamMembers.releasedAt)))
      .limit(1);
    if (m?.role !== "partner") return { ok: false, reason: "not_partner" } as const;
    const team = await lockTeam(tx, m.teamId);
    if (!team || !isOpen(team)) return { ok: false, reason: "locked" } as const;
    if (team.feeMode !== "each_pays") return { ok: false, reason: "founder_pays" } as const;
    await tx
      .update(teamMembers)
      .set({
        projectEnc: encrypt(content, draftBinding(m.id)),
        projectSeconds: hours.seconds,
        projectHackatimeIdEnc: encrypt(hours.hackatimeId, draftHackatimeBinding(m.id)),
        projectSavedAt: new Date(),
      })
      .where(eq(teamMembers.id, m.id));
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
  | { ok: true; teamId: string; founderName: string; partnerSpotsLeft: number; feeMode: FeeMode }
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
    // Someone whose last application was cut, or rejected for a teammate's fraud (they weren't
    // banned: that's checked above), may join a team; anything else live blocks it.
    if (live && live.status !== "rejected_cut" && live.status !== "rejected_fraud") {
      return { ok: false, reason: "has_application" };
    }
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
    feeMode: team.feeMode,
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

/** A partner's saved project as read at submit, with their Hackatime account id decrypted. */
export type SubmitProject = PartnerProject & { hackatimeId: string };

export type SubmitTeam = {
  teamId: string | null;
  feeMode: FeeMode;
  members: { userId: string; role: TeamRole; name: string; project: SubmitProject | null }[];
};

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
    const names = await namesOf(tx, [founderId]);
    return {
      teamId: null,
      feeMode: "founder_pays",
      members: [{ userId: founderId, role: "founder", name: names.get(founderId) ?? "(no name)", project: null }],
    };
  }
  const team = await lockTeam(tx, m.teamId);
  if (!team || !isOpen(team) || postedVersion !== team.version) return "stale";
  const rows = await activeMemberRows(tx, team.id);
  const names = await namesOf(
    tx,
    rows.map((r) => r.userId),
  );
  return {
    teamId: team.id,
    feeMode: team.feeMode,
    members: rows.map((r) => ({
      userId: r.userId,
      role: r.role,
      name: names.get(r.userId) ?? "(no name)",
      project:
        r.projectEnc && r.projectSeconds !== null && r.projectSavedAt && r.projectHackatimeIdEnc
          ? {
              content: decrypt<PartnerProjectContent>(r.projectEnc, draftBinding(r.id)),
              seconds: r.projectSeconds,
              savedAt: r.projectSavedAt,
              hackatimeId: decrypt<string>(r.projectHackatimeIdEnc, draftHackatimeBinding(r.id)),
            }
          : null,
    })),
  };
}

/** Records who's on the application and locks the team. */
export async function lockForApplication(tx: Tx, applicationId: string, submit: SubmitTeam, creditedPerPartner: number) {
  // In "each pays" mode each partner's saved project is frozen onto the application as submitted.
  const freeze = submit.feeMode === "each_pays";
  await tx.insert(applicationMembers).values(
    submit.members.map((m) => {
      const p = freeze && m.role === "partner" ? m.project : null;
      return {
        applicationId,
        userId: m.userId,
        role: m.role,
        ...(p && {
          contentEnc: encrypt(p.content, memberContentBinding(applicationId, m.userId)),
          hackatimeSecondsSnapshot: p.seconds,
          creditedSeconds: creditedPerPartner,
          hackatimeIdEnc: encrypt(p.hackatimeId, memberHackatimeBinding(applicationId, m.userId)),
        }),
      };
    }),
  );
  if (submit.teamId) await bump(tx, submit.teamId, { lockedAt: new Date() });
}

/**
 * Applies a review decision to the application's team. An interview invite isn't final, so the
 * team stays locked with everyone on it until the round-two decision.
 */
export async function onDecision(
  tx: Tx,
  teamId: string | null,
  status: "interview" | "approved" | "rejected_cut" | "rejected_malformed" | "rejected_fraud",
) {
  if (!teamId) return;
  await lockTeam(tx, teamId);
  if (status === "interview") {
    await bump(tx, teamId);
  } else if (status === "rejected_malformed") {
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

/** A partner's project as frozen on an "each pays" application. */
export type MemberProject = {
  userId: string;
  name: string;
  content: PartnerProjectContent;
  snapshotSeconds: number;
  creditedSeconds: number;
  hackatimeId: string;
};

/** Partners' frozen projects on an application (empty unless it was submitted "each pays"). */
export async function memberProjectsOf(applicationId: string): Promise<MemberProject[]> {
  const rows = await db()
    .select()
    .from(applicationMembers)
    .where(and(eq(applicationMembers.applicationId, applicationId), isNotNull(applicationMembers.contentEnc)));
  const names = await namesOf(
    db(),
    rows.map((r) => r.userId),
  );
  return rows
    .map((r) => ({
      userId: r.userId,
      name: names.get(r.userId) ?? "(no name)",
      content: decrypt<PartnerProjectContent>(r.contentEnc!, memberContentBinding(applicationId, r.userId)),
      snapshotSeconds: r.hackatimeSecondsSnapshot!,
      creditedSeconds: r.creditedSeconds!,
      hackatimeId: decrypt<string>(r.hackatimeIdEnc!, memberHackatimeBinding(applicationId, r.userId)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
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
