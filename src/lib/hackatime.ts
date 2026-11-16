import "server-only";
import { cookies } from "next/headers";
import { decrypt, encrypt } from "@/lib/crypto";
import { env } from "@/lib/env";
import { CREDITED_SECONDS } from "@/db/schema";
import { hackatime } from "@/lib/auth/providers";
export { eligibleProjects, feeSeconds, formatHours, type HackatimeProject } from "./hackatime-shared";
import type { HackatimeProject } from "./hackatime-shared";

export const HACKATIME_COOKIE = "ff_hackatime";
const TOKEN_MINUTES = 30;
const binding = (userId: string) => ({ table: "cookie", column: HACKATIME_COOKIE, rowId: userId });

export class HackatimeUnavailableError extends Error {
  constructor(message = "Hackatime is unavailable right now") {
    super(message);
    this.name = "HackatimeUnavailableError";
  }
}

/** Not stored in the database: kept only in a short-lived encrypted cookie bound to the user. */
export async function saveHackatimeToken(userId: string, accessToken: string) {
  (await cookies()).set(HACKATIME_COOKIE, encrypt({ t: accessToken }, binding(userId)), {
    httpOnly: true,
    secure: !env().APP_URL.startsWith("http://"),
    sameSite: "lax",
    path: "/",
    maxAge: TOKEN_MINUTES * 60,
  });
}

export async function readHackatimeToken(userId: string): Promise<string | null> {
  const raw = (await cookies()).get(HACKATIME_COOKIE)?.value;
  if (!raw) return null;
  try {
    return decrypt<{ t: string }>(raw, binding(userId)).t;
  } catch {
    return null;
  }
}

export async function clearHackatimeToken() {
  (await cookies()).delete(HACKATIME_COOKIE);
}

/** All of the user's Hackatime projects (all-time totals). Throws HackatimeUnavailableError on failure. */
export async function fetchProjects(accessToken: string): Promise<HackatimeProject[]> {
  let res: Response;
  try {
    res = await fetch(hackatime().projects, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch {
    throw new HackatimeUnavailableError();
  }
  if (res.status === 401) throw new HackatimeUnavailableError("Hackatime access expired — reconnect Hackatime");
  if (!res.ok) throw new HackatimeUnavailableError();
  const body = (await res.json().catch(() => null)) as { projects?: unknown } | null;
  if (!body || !Array.isArray(body.projects)) throw new HackatimeUnavailableError();
  return body.projects
    .filter((p): p is { name: string; total_seconds: number } =>
      typeof p === "object" && p !== null && typeof (p as { name?: unknown }).name === "string" &&
      typeof (p as { total_seconds?: unknown }).total_seconds === "number")
    .map((p) => ({ name: p.name, totalSeconds: Math.floor(p.total_seconds) }));
}

/** The Hackatime account id for this token, or null if Hackatime didn't give one. Never throws. */
export async function fetchHackatimeId(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(hackatime().me, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as { id?: unknown } | null;
    const id = body?.id;
    if (typeof id === "number" && Number.isSafeInteger(id) && id > 0) return String(id);
    if (typeof id === "string" && /^\d+$/.test(id)) return id;
    return null;
  } catch {
    return null;
  }
}

export const userHackatimeIdBinding = (userId: string) => ({ table: "users", column: "hackatime_id_enc", rowId: userId });

export { CREDITED_SECONDS };
