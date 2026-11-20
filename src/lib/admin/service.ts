import "server-only";
import { and, desc, eq, isNotNull, isNull, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { applicationMembers, applications, programBans, users } from "@/db/schema";
import { decrypt, encrypt } from "@/lib/crypto";
import { recordFunnelEvent } from "@/lib/funnel";
import { userHackatimeIdBinding } from "@/lib/hackatime";
import { assertAdmin } from "@/lib/auth/guards";
import { piiBinding, type UserPii } from "@/lib/auth/session";
import {
  finalJustificationBinding,
  finalNoteBinding,
  justificationBinding,
  noteBinding,
  predecessorsOf,
  toView,
  type ApplicationView,
} from "@/lib/applications/service";
import type { ApplicationKind, ApplicationStatus } from "@/lib/applications/shared";
import { memberProjectsOf, membersOfApplication, namesOf, onDecision, type Member, type MemberProject } from "@/lib/teams/service";

const KINDS = ["project", "aid"] as const;
const STATUSES = ["submitted", "interview", "approved", "rejected_cut", "rejected_malformed", "rejected_fraud"] as const;

export type ListFilter = { kind?: ApplicationKind; status?: ApplicationStatus };

export function parseFilter(q: Record<string, string | string[] | undefined>): ListFilter {
  const one = (v: unknown) => (typeof v === "string" ? v : undefined);
  const kind = one(q.kind);
  const status = one(q.status);
  return {
    kind: (KINDS as readonly string[]).includes(kind ?? "") ? (kind as ApplicationKind) : undefined,
    status: (STATUSES as readonly string[]).includes(status ?? "") ? (status as ApplicationStatus) : undefined,
  };
}

export type ListRow = {
  id: string;
  kind: ApplicationKind;
  status: ApplicationStatus;
  createdAt: Date;
  applicantName: string;
  replacesEarlier: boolean;
};

function piiOf(row: { id: string; piiEnc: string }): UserPii {
  return decrypt<UserPii>(row.piiEnc, piiBinding(row.id));
}

/** Live applications (superseded ones appear only as history on their replacement). */
export async function listApplications(filter: ListFilter): Promise<ListRow[]> {
  await assertAdmin();
  const where: SQL[] = [isNull(applications.supersededById)];
  if (filter.kind) where.push(eq(applications.kind, filter.kind));
  if (filter.status) where.push(eq(applications.status, filter.status));
  const rows = await db()
    .select({
      id: applications.id,
      kind: applications.kind,
      status: applications.status,
      createdAt: applications.createdAt,
      userId: users.id,
      piiEnc: users.piiEnc,
    })
    .from(applications)
    .innerJoin(users, eq(users.id, applications.userId))
    .where(and(...where))
    .orderBy(desc(applications.createdAt));
  const replaced = new Set(
    (
      await db()
        .select({ by: applications.supersededById })
        .from(applications)
        .where(isNotNull(applications.supersededById))
    ).map((r) => r.by),
  );
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    status: r.status,
    createdAt: r.createdAt,
    applicantName: piiOf({ id: r.userId, piiEnc: r.piiEnc }).name ?? "(no name)",
    replacesEarlier: replaced.has(r.id),
  }));
}

export type ApplicationDetail = {
  app: ApplicationView;
  live: boolean;
  applicant: UserPii;
  /** When the first pass was decided (`app.decidedAt` is the latest round's). */
  firstDecidedAt: Date | null;
  /** First-pass note to the applicant (`app.note` is the latest round's). */
  firstNote: string | null;
  /** First-pass internal justification (never shown to the applicant; this is what Airtable gets). */
  justification: string | null;
  /** The decision after the interview, once made. */
  round2: { decidedBy: string | null; decidedAt: Date; note: string | null; justification: string | null } | null;
  airtable: { recordId: string; syncedAt: Date } | null;
  banned: boolean;
  /** Members banned for fraud on this application (the founder or one partner). */
  bannedNames: string[];
  /** The applicant's Hackatime id from their latest connection, for versions submitted before ids were saved. */
  applicantHackatimeId: string | null;
  decidedBy: string | null;
  history: ApplicationView[];
  /** Team as submitted, keyed by application id (this one and every earlier version). */
  members: Record<string, Member[]>;
  /** Partners' own projects on "each pays" applications, keyed like `members`. */
  projects: Record<string, MemberProject[]>;
};

export async function getApplicationDetail(id: string): Promise<ApplicationDetail | null> {
  await assertAdmin();
  const row = await db().query.applications.findFirst({ where: eq(applications.id, id) });
  if (!row) return null;
  const applicant = await db().query.users.findFirst({ where: eq(users.id, row.userId) });
  const adminName = async (userId: string | null) => {
    if (!userId) return null;
    const admin = await db().query.users.findFirst({ where: eq(users.id, userId) });
    if (!admin) return null;
    const p = piiOf(admin);
    return p.name ?? p.hcId;
  };
  const decidedBy = await adminName(row.decidedByUserId);
  const history = await predecessorsOf(row.id);
  const ban = await db().query.programBans.findFirst({ where: eq(programBans.userId, row.userId) });
  const bansHere = await db().select({ userId: programBans.userId }).from(programBans).where(eq(programBans.applicationId, row.id));
  const bannedNames = [...(await namesOf(db(), bansHere.map((b) => b.userId))).values()];
  return {
    app: toView(row),
    firstDecidedAt: row.decidedAt,
    firstNote: row.noteEnc ? decrypt<string>(row.noteEnc, noteBinding(row.id)) : null,
    justification: row.justificationEnc ? decrypt<string>(row.justificationEnc, justificationBinding(row.id)) : null,
    round2: row.finalDecidedAt
      ? {
          decidedBy: await adminName(row.finalDecidedByUserId),
          decidedAt: row.finalDecidedAt,
          note: row.finalNoteEnc ? decrypt<string>(row.finalNoteEnc, finalNoteBinding(row.id)) : null,
          justification: row.finalJustificationEnc
            ? decrypt<string>(row.finalJustificationEnc, finalJustificationBinding(row.id))
            : null,
        }
      : null,
    airtable: row.airtableRecordId && row.airtableSyncedAt ? { recordId: row.airtableRecordId, syncedAt: row.airtableSyncedAt } : null,
    banned: !!ban,
    bannedNames,
    live: row.supersededById === null,
    applicant: applicant ? piiOf(applicant) : { hcId: "?", name: null, email: null, slackId: null },
    applicantHackatimeId: applicant?.hackatimeIdEnc
      ? decrypt<string>(applicant.hackatimeIdEnc, userHackatimeIdBinding(applicant.id))
      : null,
    decidedBy,
    history,
    members: Object.fromEntries(
      await Promise.all([row.id, ...history.map((h) => h.id)].map(async (id) => [id, await membersOfApplication(id)] as const)),
    ),
    projects: Object.fromEntries(
      await Promise.all([row.id, ...history.map((h) => h.id)].map(async (id) => [id, await memberProjectsOf(id)] as const)),
    ),
  };
}

export type Decision = "approve" | "select" | "reject_cut" | "reject_malformed" | "reject_fraud";
export type DecideResult =
  | { ok: true }
  | {
      ok: false;
      error: "note_required" | "justification_required" | "already_decided" | "not_found" | "bad_ban_target" | "wrong_round";
    };

type Decided = Exclude<ApplicationStatus, "submitted">;

/**
 * What each decision does in each round. Round one decides a pending application, and approving it
 * only invites the team to interview. Round two decides an application after its interview.
 */
const STATUS_FOR: { 1: Partial<Record<Decision, Decided>>; 2: Partial<Record<Decision, Decided>> } = {
  1: { approve: "interview", reject_cut: "rejected_cut", reject_malformed: "rejected_malformed", reject_fraud: "rejected_fraud" },
  2: { select: "approved", reject_cut: "rejected_cut", reject_fraud: "rejected_fraud" },
};

/** What each decision asks of the reviewer. The note goes to the applicant; the justification stays internal. */
export const DECISION_RULES: Record<Decision, { note: "required" | "optional" | "none"; justification: boolean }> = {
  approve: { note: "optional", justification: true },
  select: { note: "optional", justification: true },
  reject_cut: { note: "required", justification: true },
  reject_malformed: { note: "required", justification: false },
  reject_fraud: { note: "none", justification: true },
};

/**
 * Decides one round of a live application. Round one (from "submitted") is approve, cut, needs
 * changes or fraud, where approve invites the team to interview. Round two (from "interview") is
 * select, cut or fraud, and is recorded separately so the first-pass record stays as it was.
 * A fraud rejection rejects the whole team and bans one member: `banUserId` if given (it must be on
 * the application), else the founder. The deciding admin is always the signed-in user.
 */
export async function decide(
  id: string,
  decision: Decision,
  note: string,
  justification = "",
  banUserId: string | null = null,
): Promise<DecideResult> {
  const admin = await assertAdmin();
  const rules = DECISION_RULES[decision];
  const trimmed = rules.note === "none" ? "" : note.trim();
  const why = rules.justification ? justification.trim() : "";
  if (rules.note === "required" && !trimmed) return { ok: false, error: "note_required" };
  if (rules.justification && !why) return { ok: false, error: "justification_required" };
  return db().transaction(async (tx) => {
    // Checked before anything is written: returning from the transaction commits.
    const [app] = await tx
      .select({ userId: applications.userId, status: applications.status, supersededById: applications.supersededById })
      .from(applications)
      .where(eq(applications.id, id));
    if (!app) return { ok: false, error: "not_found" } as DecideResult;
    const round = app.status === "submitted" ? 1 : app.status === "interview" ? 2 : null;
    if (!round || app.supersededById) return { ok: false, error: "already_decided" } as DecideResult;
    const status = STATUS_FOR[round][decision];
    if (!status) {
      // Approving again in round two repeats a round that's already decided.
      return { ok: false, error: round === 2 && decision === "approve" ? "already_decided" : "wrong_round" } as DecideResult;
    }
    let banTarget: string | null = null;
    if (status === "rejected_fraud") {
      banTarget = banUserId || app.userId;
      if (banTarget !== app.userId) {
        const [member] = await tx
          .select({ userId: applicationMembers.userId })
          .from(applicationMembers)
          .where(and(eq(applicationMembers.applicationId, id), eq(applicationMembers.userId, banTarget)))
          .limit(1);
        if (!member) return { ok: false, error: "bad_ban_target" } as DecideResult;
      }
    }
    const record =
      round === 1
        ? {
            decidedAt: new Date(),
            decidedByUserId: admin.id,
            noteEnc: trimmed ? encrypt(trimmed, noteBinding(id)) : null,
            justificationEnc: why ? encrypt(why, justificationBinding(id)) : null,
          }
        : {
            finalDecidedAt: new Date(),
            finalDecidedByUserId: admin.id,
            finalNoteEnc: trimmed ? encrypt(trimmed, finalNoteBinding(id)) : null,
            finalJustificationEnc: why ? encrypt(why, finalJustificationBinding(id)) : null,
          };
    const updated = await tx
      .update(applications)
      .set({ status, ...record })
      .where(
        and(
          eq(applications.id, id),
          eq(applications.status, round === 1 ? "submitted" : "interview"),
          isNull(applications.supersededById),
        ),
      )
      .returning({ userId: applications.userId, teamId: applications.teamId });
    if (!updated.length) return { ok: false, error: "already_decided" } as DecideResult;
    // "Needs changes" reopens the team, an interview keeps it locked, a final decision releases it.
    await onDecision(tx, updated[0].teamId, status);
    if (status === "rejected_fraud") {
      await tx
        .insert(programBans)
        .values({ userId: banTarget ?? updated[0].userId, applicationId: id })
        .onConflictDoNothing();
    }
    await recordFunnelEvent(
      round === 1 ? "decided" : "interviewed",
      { userId: updated[0].userId, meta: { decision: status }, dedupeKey: `${round === 1 ? "decided" : "interviewed"}:${id}` },
      tx,
    );
    return { ok: true } as DecideResult;
  });
}
