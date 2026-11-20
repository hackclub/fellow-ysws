import Link from "next/link";
import { PortalHero } from "@/components/portal/PortalHero";
import { LeaveButton } from "@/components/submissions/LeaveButton";
import { PartnerProjectForm } from "@/components/submissions/PartnerProjectForm";
import { StatusBox, StatusCard } from "@/components/submissions/StatusCard";
import { TeamMembers } from "@/components/submissions/TeamMembers";
import { interviewBookingUrl } from "@/content/portal";
import { requireUser } from "@/lib/auth/guards";
import { decisionSeen, firstName, getPortalState } from "@/lib/applications/portal";
import { projectsStateFor } from "@/lib/hackatime-projects";
import { getMyPartnerProject, memberProjectsOf, membersOfApplication } from "@/lib/teams/service";
import { isBanned } from "@/lib/applications/service";
import { db } from "@/db";

export const metadata = { title: "Applicant portal — Hack Club Fellows Fund™" };

export default async function SubmissionsPage({ searchParams }: PageProps<"/submissions">) {
  const user = await requireUser("/submissions");
  const { app, partner } = await getPortalState(user);
  const q = await searchParams;
  const [members, seen, partnerProject, frozen, banned] = await Promise.all([
    app ? membersOfApplication(app.id) : [],
    decisionSeen(app),
    partner ? getMyPartnerProject(user.id) : null,
    partner && app?.feeMode === "each_pays" ? memberProjectsOf(app.id) : [],
    app?.status === "rejected_fraud" ? isBanned(db(), user.id) : false,
  ]);
  // A partner sees only their own submitted project, not their teammates'.
  const ownProject = frozen.find((p) => p.userId === user.id) ?? null;
  // While the team is open, a partner on an "everyone pays" team adds their own project here.
  const addsProject = !!partner?.open && partnerProject?.open === true && partnerProject.feeMode === "each_pays";
  const projects = addsProject
    ? await projectsStateFor(user.id, typeof q.hackatime === "string" ? q.hackatime : undefined)
    : null;

  return (
    <main>
      <PortalHero name={firstName(user.name)} kind={app?.kind ?? null} role={partner ? "partner" : "founder"} />

      <div className="container page portal-body">
        {q.submitted && (
          <p className="notice" role="status">
            submitted. you&apos;re in the pile.
          </p>
        )}
        {q.joined && (
          <p className="notice" role="status">
            you joined the team.
          </p>
        )}
        {q.left && (
          <p className="notice" role="status">
            you left the team.
          </p>
        )}
        {q.project === "saved" && (
          <p className="notice" role="status">
            your project is saved. you&apos;re ready.
          </p>
        )}
        {q.partner && partner && (
          <p className="notice" role="status">
            you&apos;re a partner on a team, so you can&apos;t apply on your own until its application is decided.
          </p>
        )}
        {q.leave === "refused" && (
          <p className="notice" role="alert">
            your team has already applied, so you can&apos;t leave it now.
          </p>
        )}
        {q.deleted && (
          <p className="notice" role="status">
            your application was deleted.
          </p>
        )}
        {q.delete === "refused" && (
          <p className="notice" role="alert">
            decided applications can&apos;t be deleted.
          </p>
        )}

        {app ? (
          <StatusCard
            app={app}
            members={members}
            viewer={partner ? "partner" : "founder"}
            decisionSeen={seen}
            ownProject={ownProject}
            banned={banned}
            bookingUrl={
              !partner && app.status === "interview"
                ? interviewBookingUrl({ name: user.name, email: user.email, applicationId: app.id })
                : null
            }
          />
        ) : (
          <section className="stack" aria-labelledby="status-heading">
            <h2 id="status-heading">Application status:</h2>
            <StatusBox title={["Not", "started"]}>
              {partner ? (
                <p className="status-body">
                  your team hasn&apos;t applied yet. the founder submits the application for everyone.
                </p>
              ) : (
                <>
                  <p className="status-body">you haven&apos;t applied yet.</p>
                  <div>
                    <Link href="/apply" className="button">
                      Apply to FELLOWS FUND™
                    </Link>
                  </div>
                </>
              )}
            </StatusBox>
          </section>
        )}

        {addsProject && partnerProject && projects && (
          <PartnerProjectForm founderName={partnerProject.founderName} projects={projects} saved={partnerProject.project} />
        )}
        {partner?.open && partnerProject?.open && partnerProject.feeMode === "founder_pays" && (
          <p className="notice" role="status" data-testid="founder-covers">
            {partnerProject.founderName} is covering your hours, so you don&apos;t need to add a project.
          </p>
        )}

        {partner?.open && (
          <>
            <TeamMembers members={partner.members} title={app ? "Team right now" : "Team"} />
            <div>
              <LeaveButton />
            </div>
          </>
        )}

        <form action="/auth/signout" method="post">
          <button className="text-link" type="submit">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
