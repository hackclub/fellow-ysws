import "server-only";
import { cookies } from "next/headers";
import { decrypt, encrypt } from "@/lib/crypto";

/** Short-lived encrypted cookie holding OAuth state + PKCE verifier between start and callback. */
type FlowState = { state: string; verifier: string; next: string };

const name = (provider: string) => `ff_oauth_${provider}`;
const binding = (provider: string) => ({ table: "cookie", column: name(provider), rowId: "flow" });

export async function saveFlow(provider: string, flow: FlowState) {
  (await cookies()).set(name(provider), encrypt(flow, binding(provider)), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && !process.env.APP_URL?.startsWith("http://"),
    sameSite: "lax",
    path: "/auth",
    maxAge: 600,
  });
}

/** Reads and clears the flow cookie. Returns null if missing, expired or tampered. */
export async function takeFlow(provider: string): Promise<FlowState | null> {
  const jar = await cookies();
  const raw = jar.get(name(provider))?.value;
  jar.delete({ name: name(provider), path: "/auth" });
  if (!raw) return null;
  try {
    return decrypt<FlowState>(raw, binding(provider));
  } catch {
    return null;
  }
}

/** Only same-site relative paths are allowed as post-login destinations. */
export function safeNext(next: string | null | undefined, fallback = "/apply"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
