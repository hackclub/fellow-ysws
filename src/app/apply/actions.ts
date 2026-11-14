"use server";

import { redirect } from "next/navigation";
import { ForbiddenError, requireUserForAction } from "@/lib/auth/guards";
import { submitApplication } from "@/lib/applications/service";
import type { ApplicationInput, FieldErrors } from "@/lib/applications/shared";
import { recordFunnelEvent } from "@/lib/funnel";
import { readHackatimeToken } from "@/lib/hackatime";
import { getMyTeam, type TeamView } from "@/lib/teams/service";

/** `team` comes back when the team changed after the form loaded, so the founder can review it. */
export type SubmitState = { errors: FieldErrors; team?: TeamView | null } | null;

function inputFrom(form: FormData): ApplicationInput {
  const s = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v : undefined;
  };
  const b = (k: string) => form.get(k) === "on";
  return {
    kind: s("kind") === "aid" ? "aid" : "project",
    hackatimeProject: s("hackatimeProject"),
    codeUrl: s("codeUrl"),
    playableUrl: s("playableUrl"),
    description: s("description"),
    heardFrom: s("heardFrom"),
    videoUrl: s("videoUrl"),
    aidReason: s("aidReason"),
    ackNewToHackClub: b("ackNewToHackClub"),
    ackOnceOnly: b("ackOnceOnly"),
    ackVideoContents: b("ackVideoContents"),
  };
}

export async function submitAction(_prev: SubmitState, form: FormData): Promise<SubmitState> {
  let user;
  try {
    user = await requireUserForAction();
  } catch (e) {
    if (e instanceof ForbiddenError) return { errors: { form: "your session expired. sign in again, then submit" } };
    throw e;
  }
  const input = inputFrom(form);
  const token = input.kind === "project" ? await readHackatimeToken(user.id) : null;
  const rawVersion = form.get("teamVersion");
  const teamVersion = typeof rawVersion === "string" && /^\d+$/.test(rawVersion) ? Number(rawVersion) : null;
  const result = await submitApplication(user, input, token, teamVersion);
  if (!result.ok) {
    if (!result.errors.team) return { errors: result.errors };
    const mine = await getMyTeam(user.id);
    return { errors: result.errors, team: mine?.role === "founder" ? mine.team : null };
  }
  redirect("/submissions?submitted=1");
}

/** Fired once when the applicant first interacts with the form. */
export async function formStartedAction() {
  const user = await requireUserForAction().catch(() => null);
  if (user) await recordFunnelEvent("form_started", { userId: user.id, dedupeKey: `form_started:${user.id}` });
}
