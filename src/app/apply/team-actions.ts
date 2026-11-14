"use server";

import { ForbiddenError, requireUserForAction } from "@/lib/auth/guards";
import {
  dissolveTeam,
  formTeam,
  getMyTeam,
  kickPartner,
  replaceInvite,
  type FounderActionResult,
  type TeamView,
} from "@/lib/teams/service";

/** `team` is the founder's team after the action (null when they have none). */
export type TeamActionResult = { team: TeamView | null; error?: string };

const MESSAGES: Record<string, string> = {
  has_application: "you've already applied, so you can't start a team now",
  on_team: "you're a partner on someone else's team, so you can't start your own",
  no_team: "you don't have a team right now",
  locked: "your team is locked because your application is in review",
  not_member: "that person isn't on your team anymore",
  is_founder: "you can't remove yourself. you're the founder",
};

async function founderTeam(userId: string): Promise<TeamView | null> {
  const mine = await getMyTeam(userId);
  return mine?.role === "founder" ? mine.team : null;
}

async function run(fn: (user: { id: string }) => Promise<FounderActionResult | { ok: true } | { ok: false; reason: string }>) {
  let user;
  try {
    user = await requireUserForAction();
  } catch (e) {
    if (e instanceof ForbiddenError) return { team: null, error: "your session expired. sign in again" };
    throw e;
  }
  const r = await fn(user);
  if (!r.ok) return { team: await founderTeam(user.id), error: MESSAGES[r.reason] ?? "something went wrong" };
  return { team: "team" in r ? r.team : await founderTeam(user.id) };
}

export async function formTeamAction(): Promise<TeamActionResult> {
  return run(formTeam);
}

export async function replaceInviteAction(): Promise<TeamActionResult> {
  return run(replaceInvite);
}

export async function kickPartnerAction(partnerUserId: string): Promise<TeamActionResult> {
  if (typeof partnerUserId !== "string") return { team: null, error: "pick someone to remove" };
  return run((user) => kickPartner(user, partnerUserId));
}

export async function dissolveTeamAction(): Promise<TeamActionResult> {
  return run(dissolveTeam);
}

/** Re-reads the team so the founder can see who has joined. */
export async function refreshTeamAction(): Promise<TeamActionResult> {
  return run(async () => ({ ok: true }));
}
