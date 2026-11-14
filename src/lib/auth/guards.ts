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

/** For admin pages: non-admins get a 404 so the area isn't advertised. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/auth/hackclub/start?next=${encodeURIComponent("/admin")}`);
  if (!user.isAdmin) notFound();
  return user;
}

/** For admin server actions: throws for anyone not on the allowlist. */
export async function requireAdminForAction(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user?.isAdmin) throw new ForbiddenError();
  return user;
}
