import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { db, type Db } from "@/db";
import { funnelEvents } from "@/db/schema";

export const ANON_COOKIE = "ff_anon";
export type FunnelStep = (typeof funnelEvents.$inferInsert)["step"];

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export async function currentAnonId(): Promise<string | null> {
  return (await cookies()).get(ANON_COOKIE)?.value ?? (await headers()).get("x-ff-anon") ?? null;
}

const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|quora link|whatsapp|discord|slack|headless|lighthouse|curl|wget|python-requests|httpclient/i;

/** Matches crawler and link-preview user agents. The UA is checked, never stored. */
export function isBot(userAgent: string | null): boolean {
  return !userAgent || BOT_UA.test(userAgent);
}

/** Records at most one visit per anonymous id per UTC day, skipping bots. */
export async function recordVisit() {
  const h = await headers();
  if (isBot(h.get("user-agent"))) return;
  const anonId = await currentAnonId();
  if (!anonId) return;
  const day = new Date().toISOString().slice(0, 10);
  await recordFunnelEvent("visit", { anonId, dedupeKey: `visit:${anonId}:${day}` });
}

/**
 * Records a first-party funnel event. Never stores IPs or user agents.
 * `dedupeKey` makes repeats a no-op (e.g. one visit per anon id per day).
 */
export async function recordFunnelEvent(
  step: FunnelStep,
  opts: { userId?: string | null; anonId?: string | null; meta?: Record<string, string>; dedupeKey?: string },
  tx: Db | Tx = db(),
) {
  await tx
    .insert(funnelEvents)
    .values({
      step,
      userId: opts.userId ?? null,
      anonId: opts.anonId ?? null,
      meta: opts.meta ?? null,
      dedupeKey: opts.dedupeKey ?? null,
    })
    .onConflictDoNothing({ target: funnelEvents.dedupeKey });
}

/** Attributes a visitor's earlier anonymous events to them once they sign in. */
export async function linkAnonToUser(anonId: string, userId: string) {
  await db()
    .update(funnelEvents)
    .set({ userId })
    .where(and(eq(funnelEvents.anonId, anonId), isNull(funnelEvents.userId)));
}
