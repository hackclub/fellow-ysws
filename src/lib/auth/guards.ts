import "server-only";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "./session";

export class ForbiddenError extends Error {
  constructor() {
    super("Forbidden");
    this.name = "ForbiddenError";
  }
}

/** For pages: sends unauthenticated visitors to Hack Club sign-in, returning to `returnTo` afterwards. */
export async function requireUser(returnTo: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/auth/hackclub/start?next=${encodeURIComponent(returnTo)}`);
  return user;
}

/** For server actions: throws instead of redirecting. */
export async function requireUserForAction(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError();
  return user;
}

/**
 * For admin pages: non-admins get a 404 so the area isn't advertised.
 * Call this in EVERY admin page, not just the layout: layouts and pages render in parallel,
 * so a layout guard alone does not stop a page from running its queries and streaming its output.
 */
export async function requireAdmin(returnTo = "/admin"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/auth/hackclub/start?next=${encodeURIComponent(returnTo)}`);
  if (!user.isAdmin) notFound();
  return user;
}

/**
 * For the admin data layer: every function that reads or changes admin-only data calls this first,
 * against the current request's session. It throws for anyone not on the allowlist, so the data
 * stays protected even if a page, layout or future caller forgets its own guard.
 */
export async function assertAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user?.isAdmin) throw new ForbiddenError();
  return user;
}

/** For admin server actions: throws for anyone not on the allowlist. */
export const requireAdminForAction = assertAdmin;
