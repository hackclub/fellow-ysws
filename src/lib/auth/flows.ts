import "server-only";
import { CodeChallengeMethod, generateCodeVerifier, generateState } from "arctic";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { currentAnonId, linkAnonToUser, recordFunnelEvent } from "@/lib/funnel";
import { encrypt, safeEqual } from "@/lib/crypto";
import { clearHackatimeToken, fetchHackatimeId, saveHackatimeToken, userHackatimeIdBinding } from "@/lib/hackatime";
import { safeNext, saveFlow, takeFlow } from "./flow-cookie";
import { fetchHackClubProfile, hackatime, hackclub } from "./providers";
import { createSession, getCurrentUser, upsertUser } from "./session";

/** Returns the provider URL to redirect to. */
export async function startHackClub(next: string | null): Promise<string> {
  const p = hackclub();
  const state = generateState();
  const verifier = generateCodeVerifier();
  await saveFlow("hackclub", { state, verifier, next: safeNext(next) });
  return p.client.createAuthorizationURLWithPKCE(p.authorize, state, CodeChallengeMethod.S256, verifier, p.scopes).toString();
}

/** Returns the local path to redirect to. */
export async function finishHackClub(params: URLSearchParams): Promise<string> {
  const flow = await takeFlow("hackclub");
  const code = params.get("code");
  const state = params.get("state") ?? "";
  if (!flow || !code || !safeEqual(state, flow.state)) return "/?signin=failed";

  const p = hackclub();
  const tokens = await p.client.validateAuthorizationCode(p.token, code, flow.verifier);
  const profile = await fetchHackClubProfile(tokens.accessToken());
  // The Hack Club access token is not kept anywhere.
  const { id } = await upsertUser(profile);
  await createSession(id);

  const anonId = await currentAnonId();
  if (anonId) await linkAnonToUser(anonId, id);
  await recordFunnelEvent("signed_in", { userId: id, anonId, dedupeKey: `signed_in:${id}` });
  return flow.next;
}

export async function startHackatime(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) return `/auth/hackclub/start?next=${encodeURIComponent("/apply")}`;
  const p = hackatime();
  const state = generateState();
  const verifier = generateCodeVerifier();
  await saveFlow("hackatime", { state, verifier, next: "/apply" });
  return p.client.createAuthorizationURLWithPKCE(p.authorize, state, CodeChallengeMethod.S256, verifier, p.scopes).toString();
}

export async function finishHackatime(params: URLSearchParams): Promise<string> {
  const user = await getCurrentUser();
  const flow = await takeFlow("hackatime");
  if (!user) return "/auth/hackclub/start?next=%2Fapply";
  if (params.get("error")) {
    await clearHackatimeToken();
    return "/apply?hackatime=denied";
  }
  const code = params.get("code");
  const state = params.get("state") ?? "";
  if (!flow || !code || !safeEqual(state, flow.state)) return "/apply?hackatime=failed";

  const p = hackatime();
  let accessToken: string;
  try {
    accessToken = (await p.client.validateAuthorizationCode(p.token, code, flow.verifier)).accessToken();
  } catch {
    return "/apply?hackatime=failed";
  }
  await saveHackatimeToken(user.id, accessToken);
  const hackatimeId = await fetchHackatimeId(accessToken);
  await db()
    .update(users)
    .set({
      hackatimeConnectedAt: new Date(),
      ...(hackatimeId ? { hackatimeIdEnc: encrypt(hackatimeId, userHackatimeIdBinding(user.id)) } : {}),
    })
    .where(eq(users.id, user.id));
  await recordFunnelEvent("hackatime_connected", { userId: user.id, dedupeKey: `hackatime_connected:${user.id}` });
  return flow.next;
}
