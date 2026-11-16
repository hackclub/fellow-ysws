import { NextResponse, type NextRequest } from "next/server";

const ANON_COOKIE = "ff_anon";
// Mirrors SESSION_COOKIE in lib/auth/session.ts (not imported: that module pulls in the db).
const SESSION_COOKIE = "ff_session";
export const ANON_HEADER = "x-ff-anon";

/** Gives every browser a first-party anonymous id for funnel counting. No IP or UA is stored. */
export function proxy(req: NextRequest) {
  // Backstop for /admin: no session cookie means no admin, so never let the request reach a page.
  // Pages still call requireAdmin() themselves; this only catches a page that forgets to.
  const { pathname } = req.nextUrl;
  if ((pathname === "/admin" || pathname.startsWith("/admin/")) && !req.cookies.get(SESSION_COOKIE)?.value) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/hackclub/start";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  const existing = req.cookies.get(ANON_COOKIE)?.value;
  if (existing) return NextResponse.next();
  const id = crypto.randomUUID();
  // Expose the new id to this same request; the cookie is only readable from the next one.
  const headers = new Headers(req.headers);
  headers.set(ANON_HEADER, id);
  const res = NextResponse.next({ request: { headers } });
  res.cookies.set(ANON_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 365 * 86_400,
  });
  return res;
}

export const config = {
  // Pages only: skip assets, Next internals, auth callbacks and the test-only mock provider.
  matcher: ["/((?!_next/|favicon.ico|auth/|test-oauth/|.*\\.[a-z0-9]+$).*)"],
};
