import { cookies } from "next/headers";
import type { CurrentUser } from "@/lib/auth/session";
import { getApplicantState, getApplicationView, type ApplicationView } from "@/lib/applications/service";
import { getMyTeam, liveApplicationIdOfTeam, type Member } from "@/lib/teams/service";

export type PortalState = {
  /** The application this viewer sees: their own, or (for a partner) their team's. */
  app: ApplicationView | null;
  partner: { id: string; open: boolean; members: Member[] } | null;
};

export async function getPortalState(user: CurrentUser): Promise<PortalState> {
  const [{ live }, mine] = await Promise.all([getApplicantState(user), getMyTeam(user.id)]);
  if (mine?.role !== "partner") return { app: live, partner: null };
  const appId = await liveApplicationIdOfTeam(mine.team.id);
  return {
    app: appId ? await getApplicationView(appId) : null,
    partner: { id: mine.team.id, open: mine.team.open, members: mine.team.members },
  };
}

/** Decided applications get a letter (the interview invite is one too); everything else doesn't. */
export function letterOutcome(app: ApplicationView | null): "interview" | "admitted" | "rejected" | null {
  if (app?.status === "interview") return "interview";
  if (app?.status === "approved") return "admitted";
  if (app?.status === "rejected_cut") return "rejected";
  return null;
}

export const firstName = (name: string | null) => name?.trim().split(/\s+/)[0] || null;

export const longDate = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

/**
 * Remembers (per browser) the last decision letter the viewer opened, so the portal can move
 * from "Decision ready" to what comes next without spoiling the outcome first.
 */
export const DECISION_SEEN_COOKIE = "ff_decision_seen";

/**
 * Which letter was read: the application and its status, so reading the interview invite doesn't
 * count as reading the decision that comes after the interview.
 */
export const decisionSeenKey = (app: ApplicationView) => `${app.id}:${app.status}`;

export async function decisionSeen(app: ApplicationView | null): Promise<boolean> {
  if (!letterOutcome(app)) return false;
  return (await cookies()).get(DECISION_SEEN_COOKIE)?.value === decisionSeenKey(app!);
}
