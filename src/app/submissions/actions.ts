"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUserForAction } from "@/lib/auth/guards";
import { DECISION_SEEN_COOKIE, getPortalState, letterOutcome } from "@/lib/applications/portal";
import { deleteApplication } from "@/lib/applications/service";
import { env } from "@/lib/env";
import { leaveTeam } from "@/lib/teams/service";

export async function deleteAction() {
  const user = await requireUserForAction();
  const result = await deleteApplication(user);
  redirect(result.ok ? "/submissions?deleted=1" : "/submissions?delete=refused");
}

export async function leaveAction() {
  const user = await requireUserForAction();
  const result = await leaveTeam(user);
  redirect(result.ok ? "/submissions?left=1" : "/submissions?leave=refused");
}

/** Called when the decision letter is shown. Only the viewer's own decided application counts. */
export async function markDecisionSeenAction() {
  const user = await requireUserForAction();
  const { app } = await getPortalState(user);
  if (!app || !letterOutcome(app)) return;
  (await cookies()).set(DECISION_SEEN_COOKIE, app.id, {
    httpOnly: true,
    secure: !env().APP_URL.startsWith("http://"),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
