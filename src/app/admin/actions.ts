"use server";

import { revalidatePath } from "next/cache";
import { decide, type Decision } from "@/lib/admin/service";
import { syncReviewsToAirtable } from "@/lib/airtable/sync";
import { requireAdminForAction } from "@/lib/auth/guards";

export type DecideState = { error?: string; done?: boolean } | null;

const MESSAGES = {
  note_required: "write a note to the applicant — it's required for this decision",
  justification_required: "write a justification — it's required for this decision",
  already_decided: "this application was already decided",
  not_found: "this application no longer exists",
} as const;

export async function decideAction(_prev: DecideState, form: FormData): Promise<DecideState> {
  await requireAdminForAction();
  const id = String(form.get("id") ?? "");
  const decision = String(form.get("decision") ?? "") as Decision;
  if (!["approve", "reject_cut", "reject_malformed", "reject_fraud"].includes(decision)) return { error: "pick a decision" };
  const result = await decide(id, decision, String(form.get("note") ?? ""), String(form.get("justification") ?? ""));
  if (!result.ok) return { error: MESSAGES[result.error] };
  revalidatePath(`/admin/applications/${id}`);
  revalidatePath("/admin");
  return { done: true };
}

export type SyncState = { message: string; tone: "ok" | "error" } | null;

export async function syncAirtableAction(): Promise<SyncState> {
  await requireAdminForAction();
  const r = await syncReviewsToAirtable();
  revalidatePath("/admin");
  if (!r.ok) {
    return {
      tone: "error",
      message: r.reason === "busy" ? "a sync is already running. try again in a moment." : "airtable isn't set up on this server.",
    };
  }
  if (r.synced === 0 && r.failed === 0) return { tone: "ok", message: "nothing to sync. airtable is up to date." };
  const parts = [`synced ${r.synced} review${r.synced === 1 ? "" : "s"} to airtable.`];
  if (r.failed) parts.push(`${r.failed} failed: ${r.errors.join("; ")}`);
  return { tone: r.failed ? "error" : "ok", message: parts.join(" ") };
}
