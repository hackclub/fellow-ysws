import { TelescreenButton } from "@/components/admin/TelescreenLink";
import { PartnerProjectDetails } from "@/components/submissions/ApplicationDetails";
import type { MemberProject } from "@/lib/teams/service";

/** Each partner's own project on an "each pays" application, with its own Telescreen link. */
export function MemberProjects({ projects }: { projects: MemberProject[] }) {
  if (!projects.length) return null;
  return (
    <>
      {projects.map((p) => (
        <section key={p.userId} className="stack-sm" aria-label={`${p.name}'s project`} data-testid="member-project">
          <h3>{p.name}&apos;s project (partner)</h3>
          <PartnerProjectDetails
            content={p.content}
            snapshotSeconds={p.snapshotSeconds}
            creditedSeconds={p.creditedSeconds}
          />
          <TelescreenButton id={p.hackatimeId} project={p.content.hackatimeProject} />
        </section>
      ))}
    </>
  );
}
