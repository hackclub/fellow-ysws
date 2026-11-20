"use server";

import { redirect } from "next/navigation";
import { ForbiddenError, requireUserForAction } from "@/lib/auth/guards";
import type { PartnerProjectErrors, PartnerProjectInput } from "@/lib/applications/shared";
import { readHackatimeToken } from "@/lib/hackatime";
import { savePartnerProjectFromForm } from "@/lib/teams/partner-project";

export type PartnerProjectState = { errors: PartnerProjectErrors } | null;

/** Saves the signed-in partner's own project ("everyone pays for themselves"). */
export async function savePartnerProjectAction(_prev: PartnerProjectState, form: FormData): Promise<PartnerProjectState> {
  let user;
  try {
    user = await requireUserForAction();
  } catch (e) {
    if (e instanceof ForbiddenError) return { errors: { form: "your session expired. sign in again, then save" } };
    throw e;
  }
  const s = (k: keyof PartnerProjectInput) => {
    const v = form.get(k);
    return typeof v === "string" ? v : undefined;
  };
  const input: PartnerProjectInput = {
    hackatimeProject: s("hackatimeProject"),
    codeUrl: s("codeUrl"),
    playableUrl: s("playableUrl"),
    description: s("description"),
    heardFrom: s("heardFrom"),
  };
  const r = await savePartnerProjectFromForm(user, input, await readHackatimeToken(user.id));
  if (!r.ok) return { errors: r.errors };
  redirect("/submissions?project=saved");
}
