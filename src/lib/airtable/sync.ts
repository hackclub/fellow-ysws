import "server-only";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { applications, CREDITED_SECONDS, users } from "@/db/schema";
import { decrypt } from "@/lib/crypto";
import { env } from "@/lib/env";
import { assertAdmin } from "@/lib/auth/guards";
import { piiBinding, type UserPii } from "@/lib/auth/session";
import { justificationBinding, toView, type ApplicationView } from "@/lib/applications/service";
import type { ProjectContent } from "@/lib/applications/shared";
import { userHackatimeIdBinding } from "@/lib/hackatime";
import { buildFields } from "./fields";

/**
 * Pushes finished project reviews to the YSWS Airtable table (docs/airtable.md).
 * Synced: project applications that were approved or didn't make the cut.
 * Never synced: financial aid, "Needs changes", fraud, or anything still pending.
 */
const SYNCED_STATUSES = ["approved", "rejected_cut"] as const;
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

export async function countPendingSync(): Promise<number> {
  await assertAdmin();
  const [{ n }] = await db().select({ n: sql<number>`count(*)::int` }).from(applications).where(pending);
  return n;
}

export type SyncResult =
  | { ok: true; synced: number; failed: number; errors: string[] }
  | { ok: false; reason: "not_configured" | "busy" };

type Candidate = { app: ApplicationView; pii: UserPii; hackatimeId: string | null; justification: string | null };

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

    const rows = await tx
      .select({ app: applications, user: users })
      .from(applications)
      .innerJoin(users, eq(users.id, applications.userId))
      .where(pending)
      .orderBy(asc(applications.decidedAt));

    const candidates: Candidate[] = rows.map(({ app, user }) => {
      const view = toView(app);
      return {
        app: view,
        pii: decrypt<UserPii>(user.piiEnc, piiBinding(user.id)),
        hackatimeId:
          view.hackatimeId ?? (user.hackatimeIdEnc ? decrypt<string>(user.hackatimeIdEnc, userHackatimeIdBinding(user.id)) : null),
        justification: app.justificationEnc ? decrypt<string>(app.justificationEnc, justificationBinding(app.id)) : null,
      };
    });

    let synced = 0;
    let failed = 0;
    const errors: string[] = [];
    for (let i = 0; i < candidates.length; i += BATCH) {
      const batch = candidates.slice(i, i + BATCH);
      if (i > 0) await new Promise((r) => setTimeout(r, PAUSE_MS));
      const created = await createRecords(
        config,
        batch.map((c) =>
          buildFields({
            content: c.app.content as ProjectContent,
            pii: c.pii,
            hackatimeId: c.hackatimeId,
            loggedSeconds: c.app.hackatimeSecondsSnapshot ?? 0,
            cappedSeconds: CREDITED_SECONDS,
            submittedAt: c.app.createdAt,
            justification: c.justification,
          }),
        ),
      );
      if (!created.ok) {
        failed += batch.length;
        errors.push(created.error);
        continue;
      }
      const now = new Date();
      for (const [j, c] of batch.entries()) {
        await tx
          .update(applications)
          .set({ airtableRecordId: created.ids[j], airtableSyncedAt: now })
          .where(eq(applications.id, c.app.id));
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
