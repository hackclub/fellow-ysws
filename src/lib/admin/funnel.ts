import "server-only";
import { assertAdmin } from "@/lib/auth/guards";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const FUNNEL_STEPS = ["visit", "signed_in", "hackatime_connected", "form_started", "submitted", "decided"] as const;
export type FunnelStepName = (typeof FUNNEL_STEPS)[number];

export const STEP_LABEL: Record<FunnelStepName, string> = {
  visit: "Visited",
  signed_in: "Signed in",
  hackatime_connected: "Hackatime connected",
  form_started: "Started form",
  submitted: "Submitted",
  decided: "Decided",
};

export type FunnelReport = {
  from: Date;
  to: Date;
  steps: { step: FunnelStepName; people: number; fromPrevious: number | null }[];
  submittedByKind: Record<string, number>;
  decidedByOutcome: Record<string, number>;
};

const pct = (n: number, d: number) => (d === 0 ? null : Math.round((n / d) * 1000) / 10);

/**
 * Unique people per step in [from, to). A person is their user id once known,
 * otherwise their anonymous id (earlier anonymous events are linked on sign-in).
 */
export async function funnelReport(from: Date, to: Date): Promise<FunnelReport> {
  await assertAdmin();
  const person = sql`COALESCE(user_id::text, anon_id)`;
  const range = sql`created_at >= ${from.toISOString()} AND created_at < ${to.toISOString()}`;

  const byStep = await db().execute<{ step: FunnelStepName; people: string }>(
    sql`SELECT step, COUNT(DISTINCT ${person}) AS people FROM funnel_events WHERE ${range} GROUP BY step`,
  );
  const split = async (step: string, key: string) =>
    Object.fromEntries(
      (
        await db().execute<{ k: string; people: string }>(
          sql`SELECT meta->>${key} AS k, COUNT(DISTINCT ${person}) AS people FROM funnel_events
              WHERE step = ${step} AND ${range} GROUP BY 1`,
        )
      ).rows.map((r) => [r.k ?? "unknown", Number(r.people)]),
    );

  const counts = new Map(byStep.rows.map((r) => [r.step, Number(r.people)]));
  const steps = FUNNEL_STEPS.map((step, i) => {
    const people = counts.get(step) ?? 0;
    return { step, people, fromPrevious: i === 0 ? null : pct(people, counts.get(FUNNEL_STEPS[i - 1]) ?? 0) };
  });
  return {
    from,
    to,
    steps,
    submittedByKind: await split("submitted", "kind"),
    decidedByOutcome: await split("decided", "decision"),
  };
}

/** Parses ?from=YYYY-MM-DD&to=YYYY-MM-DD (inclusive end date); defaults to the last 30 days. */
export function parseRange(q: Record<string, string | string[] | undefined>, now = new Date()) {
  const day = (v: unknown) =>
    typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))
      ? new Date(`${v}T00:00:00Z`)
      : null;
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const toInclusive = day(q.to) ?? today;
  const from = day(q.from) ?? new Date(toInclusive.getTime() - 29 * 86_400_000);
  const to = new Date(toInclusive.getTime() + 86_400_000);
  return from < to ? { from, to } : { from: toInclusive, to };
}
