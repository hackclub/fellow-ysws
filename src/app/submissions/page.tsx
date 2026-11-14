import Link from "next/link";
import { PortalHero } from "@/components/portal/PortalHero";
import { LeaveButton } from "@/components/submissions/LeaveButton";
import { StatusBox, StatusCard } from "@/components/submissions/StatusCard";
import { TeamMembers } from "@/components/submissions/TeamMembers";
import { requireUser } from "@/lib/auth/guards";
import { decisionSeen, firstName, getPortalState } from "@/lib/applications/portal";
import { membersOfApplication } from "@/lib/teams/service";

export const metadata = { title: "Applicant portal — Hack Club Fellows Fund™" };

export default async function SubmissionsPage({ searchParams }: PageProps<"/submissions">) {
  const user = await requireUser("/submissions");
  const { app, partner } = await getPortalState(user);
  const q = await searchParams;
  const [members, seen] = await Promise.all([app ? membersOfApplication(app.id) : [], decisionSeen(app)]);

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
          <StatusCard app={app} members={members} viewer={partner ? "partner" : "founder"} decisionSeen={seen} />
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
