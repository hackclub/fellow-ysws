import "server-only";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { applicationMembers, applications, users } from "@/db/schema";
import { decrypt } from "@/lib/crypto";
import { env } from "@/lib/env";
import { assertAdmin } from "@/lib/auth/guards";
import { piiBinding, type UserPii } from "@/lib/auth/session";
import { justificationBinding, toView } from "@/lib/applications/service";
import type { PartnerProjectContent, ProjectContent } from "@/lib/applications/shared";
import { userHackatimeIdBinding } from "@/lib/hackatime";
import { memberContentBinding, memberHackatimeBinding } from "@/lib/teams/service";
import { buildFields } from "./fields";

/**
 * Pushes finished project reviews to the YSWS Airtable table (docs/airtable.md).
 * Synced: project applications that were invited to interview or didn't make the cut, one record per
 * paying project (the founder's, plus each partner's own project on "everyone pays for themselves"
 * teams). The project is taken whatever the interview's outcome, so a record is created once at the
 * invite and the round-two decision never touches it. "approved" stays for approvals from before
 * interviews existed. Never synced: financial aid, "Needs changes", fraud in round one, or anything
 * still pending.
 */
const SYNCED_STATUSES = ["interview", "approved", "rejected_cut"] as const;
const BATCH = 10; // Airtable's per-request limit
const PAUSE_MS = 250; // stays under Airtable's 5 requests/second per base

export type AirtableConfig = { api: string; pat: string; base: string; table: string };

export function airtableConfig(): AirtableConfig | null {
  const e = env();
  if (!e.AIRTABLE_PAT || !e.AIRTABLE_APP_NAME || !e.AIRTABLE_TABLE_NAME) return null;
  return { api: e.AIRTABLE_API_URL.replace(/\/$/, ""), pat: e.AIRTABLE_PAT, base: e.AIRTABLE_APP_NAME, table: e.AIRTABLE_TABLE_NAME };
}

/** The Airtable record's page, for linking from the admin view. */
export function airtableRecordUrl(recordId: string): string | null {
  const c = airtableConfig();
  return c ? `https://airtable.com/${c.base}/${c.table}/${recordId}` : null;
}

const pending = and(
  eq(applications.kind, "project"),
  inArray(applications.status, [...SYNCED_STATUSES]),
  isNull(applications.airtableRecordId),
);

/** Partners' own projects on decided "each pays" applications that don't have a record yet. */
const pendingMembers = and(
  eq(applications.kind, "project"),
  inArray(applications.status, [...SYNCED_STATUSES]),
  isNotNull(applicationMembers.contentEnc),
  isNull(applicationMembers.airtableRecordId),
);

/** Records still to create: one per paying project (the founder's, plus each partner's in "each pays"). */
export async function countPendingSync(): Promise<number> {
  await assertAdmin();
  const [[{ n }], [{ m }]] = await Promise.all([
    db().select({ n: sql<number>`count(*)::int` }).from(applications).where(pending),
    db()
      .select({ m: sql<number>`count(*)::int` })
      .from(applicationMembers)
      .innerJoin(applications, eq(applications.id, applicationMembers.applicationId))
      .where(pendingMembers),
  ]);
  return n + m;
}

export type SyncResult =
  | { ok: true; synced: number; failed: number; errors: string[] }
  | { ok: false; reason: "not_configured" | "busy" };

/** One Airtable record to create, and where its record id is written back. */
type Candidate = {
  target: { kind: "application"; id: string } | { kind: "member"; applicationId: string; userId: string };
  decidedAt: Date | null;
  fields: Parameters<typeof buildFields>[0];
};

export async function syncReviewsToAirtable(): Promise<SyncResult> {
  await assertAdmin();
  const config = airtableConfig();
  if (!config) return { ok: false, reason: "not_configured" };

  return db().transaction(async (tx) => {
    // One sync at a time, so two clicks can't create the same record twice.
    const [{ locked }] = (
      await tx.execute<{ locked: boolean }>(sql`SELECT pg_try_advisory_xact_lock(hashtext('airtable-sync')) AS locked`)
    ).rows;
    if (!locked) return { ok: false, reason: "busy" } as const;

    const justificationOf = (app: typeof applications.$inferSelect) =>
      app.justificationEnc ? decrypt<string>(app.justificationEnc, justificationBinding(app.id)) : null;

    const founderRows = await tx
      .select({ app: applications, user: users })
      .from(applications)
      .innerJoin(users, eq(users.id, applications.userId))
      .where(pending);
    const memberRows = await tx
      .select({ member: applicationMembers, app: applications, user: users })
      .from(applicationMembers)
      .innerJoin(applications, eq(applications.id, applicationMembers.applicationId))
      .innerJoin(users, eq(users.id, applicationMembers.userId))
      .where(pendingMembers);

    const candidates: Candidate[] = [
      ...founderRows.map(({ app, user }): Candidate => {
        const view = toView(app);
        return {
          target: { kind: "application", id: app.id },
          decidedAt: app.decidedAt,
          fields: {
            content: view.content as ProjectContent,
            pii: decrypt<UserPii>(user.piiEnc, piiBinding(user.id)),
            hackatimeId:
              view.hackatimeId ??
              (user.hackatimeIdEnc ? decrypt<string>(user.hackatimeIdEnc, userHackatimeIdBinding(user.id)) : null),
            loggedSeconds: view.hackatimeSecondsSnapshot ?? 0,
            cappedSeconds: view.creditedSeconds ?? 0,
            submittedAt: view.createdAt,
            justification: justificationOf(app),
          },
        };
      }),
      ...memberRows.map(({ member, app, user }): Candidate => ({
        target: { kind: "member", applicationId: app.id, userId: member.userId },
        decidedAt: app.decidedAt,
        fields: {
          content: decrypt<PartnerProjectContent>(member.contentEnc!, memberContentBinding(app.id, member.userId)),
          pii: decrypt<UserPii>(user.piiEnc, piiBinding(user.id)),
          hackatimeId: decrypt<string>(member.hackatimeIdEnc!, memberHackatimeBinding(app.id, member.userId)),
          loggedSeconds: member.hackatimeSecondsSnapshot ?? 0,
          cappedSeconds: member.creditedSeconds ?? 0,
          submittedAt: app.createdAt,
          justification: justificationOf(app),
        },
      })),
    ].sort((a, b) => (a.decidedAt?.getTime() ?? 0) - (b.decidedAt?.getTime() ?? 0));

    let synced = 0;
    let failed = 0;
    const errors: string[] = [];
    for (let i = 0; i < candidates.length; i += BATCH) {
      const batch = candidates.slice(i, i + BATCH);
      if (i > 0) await new Promise((r) => setTimeout(r, PAUSE_MS));
      const created = await createRecords(
        config,
        batch.map((c) => buildFields(c.fields)),
      );
      if (!created.ok) {
        failed += batch.length;
        errors.push(created.error);
        continue;
      }
      // Each record is marked on its own row, so a later failure only retries what's missing.
      const now = new Date();
      for (const [j, c] of batch.entries()) {
        const set = { airtableRecordId: created.ids[j], airtableSyncedAt: now };
        if (c.target.kind === "application") {
          await tx.update(applications).set(set).where(eq(applications.id, c.target.id));
        } else {
          await tx
            .update(applicationMembers)
            .set(set)
            .where(
              and(
                eq(applicationMembers.applicationId, c.target.applicationId),
                eq(applicationMembers.userId, c.target.userId),
              ),
            );
        }
      }
      synced += batch.length;
    }
    return { ok: true, synced, failed, errors } as const;
  });
}

async function createRecords(
  c: AirtableConfig,
  records: Record<string, unknown>[],
): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
  let res: Response;
  try {
    res = await fetch(`${c.api}/v0/${encodeURIComponent(c.base)}/${encodeURIComponent(c.table)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.pat}`, "Content-Type": "application/json" },
      body: JSON.stringify({ records: records.map((fields) => ({ fields })) }),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "couldn't reach airtable" };
  }
  const body = (await res.json().catch(() => null)) as
    | { records?: { id?: unknown }[]; error?: { type?: string; message?: string } | string }
    | null;
  if (!res.ok) {
    const err = typeof body?.error === "string" ? body.error : body?.error?.message ?? body?.error?.type;
    return { ok: false, error: `airtable said ${res.status}${err ? `: ${err}` : ""}` };
  }
  const ids = body?.records?.map((r) => r.id);
  if (!ids || ids.length !== records.length || !ids.every((id): id is string => typeof id === "string")) {
    return { ok: false, error: "airtable returned an unexpected response" };
  }
  return { ok: true, ids };
}
