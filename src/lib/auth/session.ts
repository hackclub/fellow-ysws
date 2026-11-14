import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { decrypt, encrypt, hcIdHash, randomToken, tokenHash } from "@/lib/crypto";
import { env } from "@/lib/env";
import type { HackClubProfile, PostalAddress } from "./providers";

export const SESSION_COOKIE = "ff_session";
const SESSION_DAYS = 30;

export type UserPii = {
  hcId: string;
  name: string | null;
  email: string | null;
  slackId: string | null;
  // From Hack Club Auth when the scopes allow; absent for users who haven't signed in since.
  givenName?: string | null;
  familyName?: string | null;
  birthdate?: string | null;
  address?: PostalAddress | null;
};

export type CurrentUser = UserPii & {
  id: string;
  isAdmin: boolean;
  hackatimeConnectedAt: Date | null;
};

export const piiBinding = (userId: string) => ({ table: "users", column: "pii_enc", rowId: userId });

/** Finds the user by keyed hash of their Hack Club id, creating them on first sign-in. Refreshes PII. */
export async function upsertUser(profile: HackClubProfile): Promise<{ id: string; created: boolean }> {
  const hash = hcIdHash(profile.sub);
  const pii: UserPii = {
    hcId: profile.sub,
    name: profile.name,
    email: profile.email,
    slackId: profile.slackId,
    givenName: profile.givenName,
    familyName: profile.familyName,
    birthdate: profile.birthdate,
    address: profile.address,
  };
  const existing = await db().query.users.findFirst({ where: eq(users.hcIdHash, hash), columns: { id: true } });
  if (existing) {
    await db().update(users).set({ piiEnc: encrypt(pii, piiBinding(existing.id)) }).where(eq(users.id, existing.id));
    return { id: existing.id, created: false };
  }
  const id = randomUUID();
  const inserted = await db()
    .insert(users)
    .values({ id, hcIdHash: hash, piiEnc: encrypt(pii, piiBinding(id)) })
    .onConflictDoNothing({ target: users.hcIdHash })
    .returning({ id: users.id });
  if (inserted.length) return { id, created: true };
  // Lost a race with a concurrent first sign-in.
  return upsertUser(profile);
}

export async function createSession(userId: string) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db().insert(sessions).values({ idHash: tokenHash(token), userId, expiresAt });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: !env().APP_URL.startsWith("http://"),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db().delete(sessions).where(eq(sessions.idHash, tokenHash(token)));
  jar.delete(SESSION_COOKIE);
}

export async function loadUser(userId: string): Promise<CurrentUser | null> {
  const row = await db().query.users.findFirst({ where: eq(users.id, userId) });
  if (!row) return null;
  const pii = decrypt<UserPii>(row.piiEnc, piiBinding(row.id));
  return { ...pii, id: row.id, hackatimeConnectedAt: row.hackatimeConnectedAt, isAdmin: env().adminIds.has(pii.hcId) };
}

/** The signed-in user for this request, or null. Memoised per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [s] = await db()
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(and(eq(sessions.idHash, tokenHash(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return s ? loadUser(s.userId) : null;
});
