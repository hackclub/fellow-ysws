import type { Member } from "@/lib/teams/service";

/** Who's on an application's team, founder first. */
export function TeamMembers({ members, title = "Team" }: { members: Member[]; title?: string }) {
  return (
    <section className="stack-sm" aria-label={title} data-testid="team-members">
      <span className="field-label">{title}</span>
      <ul className="team-list">
        {members.map((m) => (
          <li key={m.userId} className="panel-row">
            <span>{m.name}</span>
            <span className="small muted">{m.role}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
