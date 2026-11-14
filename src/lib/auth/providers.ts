import "server-only";
import { OAuth2Client } from "arctic";
import { env } from "@/lib/env";

/** Hack Club Auth (OIDC). See docs/hackclub-auth.md. */
export function hackclub() {
  const e = env();
  const base = e.HACKCLUB_AUTH_URL.replace(/\/$/, "");
  return {
    client: new OAuth2Client(e.HACKCLUB_AUTH_CLIENT_ID, e.HACKCLUB_AUTH_CLIENT_SECRET, `${e.APP_URL}/auth/hackclub/callback`),
    authorize: `${base}/oauth/authorize`,
    token: `${base}/oauth/token`,
    userinfo: `${base}/oauth/userinfo`,
    // Extra scopes (e.g. "birthdate address") only work if the app is approved for them; see docs/hackclub-auth.md.
    scopes: ["openid", "profile", "email", "slack_id", ...e.HACKCLUB_AUTH_EXTRA_SCOPES.split(/\s+/).filter(Boolean)],
  };
}

/** Hackatime (OAuth 2 via Doorkeeper). See docs/hackatime.md. */
export function hackatime() {
  const e = env();
  const base = e.HACKATIME_URL.replace(/\/$/, "");
  return {
    client: new OAuth2Client(e.HACKATIME_CLIENT_ID, e.HACKATIME_CLIENT_SECRET, `${e.APP_URL}/auth/hackatime/callback`),
    authorize: `${base}/oauth/authorize`,
    token: `${base}/oauth/token`,
    projects: `${base}/api/v1/authenticated/projects`,
    me: `${base}/api/v1/authenticated/me`,
    scopes: ["profile", "read"],
  };
}

export type PostalAddress = {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
};

export type HackClubProfile = {
  sub: string;
  name: string | null;
  email: string | null;
  slackId: string | null;
  givenName: string | null;
  familyName: string | null;
  /** YYYY-MM-DD */
  birthdate: string | null;
  address: PostalAddress | null;
};

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Reads the OIDC `address` claim (standard shape, or line_1/city-style keys). */
export function parseAddress(raw: unknown): PostalAddress | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  const street = str(a.street_address)?.split(/\r?\n/) ?? [];
  const out: PostalAddress = {
    line1: str(a.line_1) ?? str(a.line1) ?? street[0] ?? null,
    line2: str(a.line_2) ?? str(a.line2) ?? (street.slice(1).join(", ") || null),
    city: str(a.locality) ?? str(a.city),
    state: str(a.region) ?? str(a.state),
    postalCode: str(a.postal_code) ?? str(a.zip),
    country: str(a.country),
  };
  return Object.values(out).some(Boolean) ? out : null;
}

const parseBirthdate = (v: unknown) => {
  const s = str(v);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

export async function fetchHackClubProfile(accessToken: string): Promise<HackClubProfile> {
  const res = await fetch(hackclub().userinfo, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Hack Club userinfo failed: ${res.status}`);
  const c = (await res.json()) as Record<string, unknown>;
  if (typeof c.sub !== "string" || !c.sub) throw new Error("Hack Club userinfo has no sub");
  return {
    sub: c.sub,
    name: str(c.name),
    email: str(c.email),
    slackId: str(c.slack_id),
    givenName: str(c.given_name),
    familyName: str(c.family_name),
    birthdate: parseBirthdate(c.birthdate),
    address: parseAddress(c.address),
  };
}
