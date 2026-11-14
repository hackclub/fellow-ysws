import "server-only";
import { and, desc, eq, isNotNull, isNull, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { applications, programBans, users } from "@/db/schema";
import { decrypt, encrypt } from "@/lib/crypto";
import { recordFunnelEvent } from "@/lib/funnel";
import { userHackatimeIdBinding } from "@/lib/hackatime";
import { piiBinding, type CurrentUser, type UserPii } from "@/lib/auth/session";
import {
  justificationBinding,
  noteBinding,
  predecessorsOf,
  toView,
  type ApplicationView,
} from "@/lib/applications/service";
import type { ApplicationKind, ApplicationStatus } from "@/lib/applications/shared";
import { membersOfApplication, onDecision, type Member } from "@/lib/teams/service";

const KINDS = ["project", "aid"] as const;
const STATUSES = ["submitted", "approved", "rejected_cut", "rejected_malformed", "rejected_fraud"] as const;

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
  /** Internal reviewer justification for this version (never shown to the applicant). */
  justification: string | null;
  airtable: { recordId: string; syncedAt: Date } | null;
  banned: boolean;
  /** The applicant's Hackatime id from their latest connection, for versions submitted before ids were saved. */
  applicantHackatimeId: string | null;
  decidedBy: string | null;
  history: ApplicationView[];
  /** Team as submitted, keyed by application id (this one and every earlier version). */
  members: Record<string, Member[]>;
};

export async function getApplicationDetail(id: string): Promise<ApplicationDetail | null> {
  const row = await db().query.applications.findFirst({ where: eq(applications.id, id) });
  if (!row) return null;
  const applicant = await db().query.users.findFirst({ where: eq(users.id, row.userId) });
  let decidedBy: string | null = null;
  if (row.decidedByUserId) {
    const admin = await db().query.users.findFirst({ where: eq(users.id, row.decidedByUserId) });
    if (admin) {
      const p = piiOf(admin);
      decidedBy = p.name ?? p.hcId;
    }
  }
  const history = await predecessorsOf(row.id);
  const ban = await db().query.programBans.findFirst({ where: eq(programBans.userId, row.userId) });
  return {
    app: toView(row),
    justification: row.justificationEnc ? decrypt<string>(row.justificationEnc, justificationBinding(row.id)) : null,
    airtable: row.airtableRecordId && row.airtableSyncedAt ? { recordId: row.airtableRecordId, syncedAt: row.airtableSyncedAt } : null,
    banned: !!ban,
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
  };
}

export type Decision = "approve" | "reject_cut" | "reject_malformed" | "reject_fraud";
export type DecideResult =
  | { ok: true }
  | { ok: false; error: "note_required" | "justification_required" | "already_decided" | "not_found" };

const STATUS_FOR: Record<Decision, Exclude<ApplicationStatus, "submitted">> = {
  approve: "approved",
  reject_cut: "rejected_cut",
  reject_malformed: "rejected_malformed",
  reject_fraud: "rejected_fraud",
};

/** What each decision asks of the reviewer. The note goes to the applicant; the justification stays internal. */
export const DECISION_RULES: Record<Decision, { note: "required" | "optional" | "none"; justification: boolean }> = {
  approve: { note: "optional", justification: true },
  reject_cut: { note: "required", justification: true },
  reject_malformed: { note: "required", justification: false },
  reject_fraud: { note: "none", justification: true },
};

/**
 * Decides a pending application; decisions are final. A fraud rejection also bans the applicant
 * from the program. Approved and cut decisions are what the Airtable sync picks up.
 */
export async function decide(
  admin: CurrentUser,
  id: string,
  decision: Decision,
  note: string,
  justification = "",
): Promise<DecideResult> {
  if (!admin.isAdmin) throw new Error("decide() requires an admin");
  const rules = DECISION_RULES[decision];
  const trimmed = rules.note === "none" ? "" : note.trim();
  const why = rules.justification ? justification.trim() : "";
  if (rules.note === "required" && !trimmed) return { ok: false, error: "note_required" };
  if (rules.justification && !why) return { ok: false, error: "justification_required" };
  const status = STATUS_FOR[decision];
  return db().transaction(async (tx) => {
    const updated = await tx
      .update(applications)
      .set({
        status,
        decidedAt: new Date(),
        decidedByUserId: admin.id,
        noteEnc: trimmed ? encrypt(trimmed, noteBinding(id)) : null,
        justificationEnc: why ? encrypt(why, justificationBinding(id)) : null,
      })
      .where(and(eq(applications.id, id), eq(applications.status, "submitted"), isNull(applications.supersededById)))
      .returning({ userId: applications.userId, teamId: applications.teamId });
    if (!updated.length) {
      const exists = await tx.query.applications.findFirst({ where: eq(applications.id, id), columns: { id: true } });
      return { ok: false, error: exists ? "already_decided" : "not_found" } as DecideResult;
    }
    // "Needs changes" reopens the team; a final decision releases everyone on it.
    await onDecision(tx, updated[0].teamId, status);
    if (status === "rejected_fraud") {
      await tx.insert(programBans).values({ userId: updated[0].userId, applicationId: id }).onConflictDoNothing();
    }
    await recordFunnelEvent(
      "decided",
      { userId: updated[0].userId, meta: { decision: status }, dedupeKey: `decided:${id}` },
      tx,
    );
    return { ok: true } as DecideResult;
  });
}
