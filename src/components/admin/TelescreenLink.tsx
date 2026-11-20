import type { ApplicationView } from "@/lib/applications/service";
import type { ProjectContent } from "@/lib/applications/shared";
import { telescreenUrl } from "@/lib/telescreen";

/** A button that opens one person's Hackatime project in Telescreen. */
export function TelescreenButton({ id, project, note }: { id: string; project: string; note?: string }) {
  return (
    <div className="stack-sm">
      <a
        href={telescreenUrl(id, project)}
        className="button quiet"
        rel="noopener noreferrer"
        target="_blank"
        data-testid="telescreen-link"
        style={{ justifySelf: "start" }}
      >
        Open “{project}” in Telescreen ↗
      </a>
      <p className="small muted">
        hackatime id {id}
        {note}
      </p>
    </div>
  );
}

/** Opens the applicant's Hackatime project in Telescreen. Project applications only. */
export function TelescreenLink({ app, fallbackId }: { app: ApplicationView; fallbackId: string | null }) {
  if (app.kind !== "project") return null;
  const project = (app.content as ProjectContent).hackatimeProject;
  const id = app.hackatimeId ?? fallbackId;
  if (!id) {
    return (
      <p className="small muted" data-testid="telescreen-missing">
        no hackatime id on file for this applicant yet, so there&apos;s no telescreen link. it&apos;s saved the next
        time they connect hackatime.
      </p>
    );
  }
  return (
    <TelescreenButton
      id={id}
      project={project}
      note={app.hackatimeId ? undefined : " (from their latest connection, not this submission)"}
    />
  );
}
