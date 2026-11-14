import Link from "next/link";
import { redirect } from "next/navigation";
import { ApplyForm } from "@/components/apply/ApplyForm";
import type { ProjectsState } from "@/components/apply/ProjectPicker";
import { requireUser } from "@/lib/auth/guards";
import { getApplicantState } from "@/lib/applications/service";
import { env } from "@/lib/env";
import { eligibleProjects, fetchProjects, HackatimeUnavailableError, readHackatimeToken } from "@/lib/hackatime";
import { getMyTeam } from "@/lib/teams/service";

export const metadata = { title: "Apply — Hack Club Fellows Fund™" };

async function projectsFor(userId: string, flag: string | undefined): Promise<ProjectsState> {
  const token = await readHackatimeToken(userId);
  if (!token) return { status: "not_connected", denied: flag === "denied", failed: flag === "failed" };
  try {
    return { status: "ok", projects: eligibleProjects(await fetchProjects(token)) };
  } catch (e) {
    if (!(e instanceof HackatimeUnavailableError)) throw e;
    return { status: "error", message: e.message, reconnect: /reconnect/i.test(e.message) };
  }
}

export default async function ApplyPage({ searchParams }: PageProps<"/apply">) {
  const user = await requireUser("/apply");
  const mine = await getMyTeam(user.id);
  // Partners on an active team can't apply on their own; their team's page is on /submissions.
  if (mine?.role === "partner") redirect("/submissions?partner=1");
  const state = await getApplicantState(user);
  if (!state.canSubmit) redirect("/submissions");
  const { hackatime } = await searchParams;
  const projects = await projectsFor(user.id, typeof hackatime === "string" ? hackatime : undefined);
  const resubmitting = state.live?.status === "rejected_malformed";
  const reapplying = state.live?.status === "rejected_cut";

  return (
    <main className="container page">
      <div className="stack narrow">
        <h1>Apply to Fellows Fund™.</h1>
        <p className="lede">ten weeks. nine online, one in san francisco. three steps to get in the pile.</p>
        {resubmitting && (
          <p className="notice" role="status">
            your last application needs changes. read the note on{" "}
            <Link href="/submissions" className="text-link accent">
              your submission
            </Link>
            , then submit a fixed version here.
          </p>
        )}
        {reapplying && (
          <p className="notice" role="status">
            welcome back.
            {!state.aidAvailable && " financial aid can only be requested once, so apply with a hackatime project."}
          </p>
        )}
      </div>
      <ApplyForm
        projects={projects}
        aidAvailable={state.aidAvailable}
        defaultAid={resubmitting && state.live?.kind === "aid"}
        team={mine?.team ?? null}
        appUrl={env().APP_URL.replace(/\/$/, "")}
      />
    </main>
  );
}
