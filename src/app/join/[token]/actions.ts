"use server";

import { redirect } from "next/navigation";
import { requireUserForAction } from "@/lib/auth/guards";
import { joinTeam } from "@/lib/teams/service";

export async function joinAction(form: FormData) {
  const token = String(form.get("token") ?? "");
  const user = await requireUserForAction();
  const result = await joinTeam(user, token);
  if (result.ok) redirect("/submissions?joined=1");
  redirect(`/join/${encodeURIComponent(token)}`);
}
