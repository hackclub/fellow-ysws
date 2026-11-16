import type { ApplicationView } from "@/lib/applications/service";
import type { AidContent, ProjectContent } from "@/lib/applications/shared";
import { formatHours } from "@/lib/hackatime-shared";

const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Read-only view of an application's contents (applicant and admin). */
export function ApplicationDetails({ app }: { app: ApplicationView }) {
  if (app.kind === "project") {
    const c = app.content as ProjectContent;
    return (
      <dl className="dl">
        <dt>Type</dt>
        <dd>project</dd>
        <dt>Hackatime project</dt>
        <dd>
          {c.hackatimeProject}
          {app.hackatimeSecondsSnapshot != null && (
            <span className="muted">
              {" "}
              — {formatHours(app.hackatimeSecondsSnapshot)} logged
              {app.creditedSeconds != null && `, ${formatHours(app.creditedSeconds)} credited`}
            </span>
          )}
        </dd>
        <dt>Code</dt>
        <dd>
          <a href={c.codeUrl} rel="noopener noreferrer" target="_blank">{c.codeUrl}</a>
        </dd>
        <dt>Playable</dt>
        <dd>
          <a href={c.playableUrl} rel="noopener noreferrer nofollow" target="_blank">{c.playableUrl}</a>
        </dd>
        <dt>Description</dt>
        <dd>{c.description}</dd>
        {c.videoUrl && (
          <>
            <dt>Video</dt>
            <dd>
              <a href={c.videoUrl} rel="noopener noreferrer" target="_blank">{c.videoUrl}</a>
            </dd>
          </>
        )}
        <dt>Heard from</dt>
        <dd>{c.heardFrom}</dd>
        <dt>Submitted</dt>
        <dd>{fmt(app.createdAt)}</dd>
      </dl>
    );
  }
  const c = app.content as AidContent;
  return (
    <dl className="dl">
      <dt>Type</dt>
      <dd>financial aid</dd>
      <dt>Video</dt>
      <dd>
        <a href={c.videoUrl} rel="noopener noreferrer" target="_blank">{c.videoUrl}</a>
      </dd>
      <dt>Why aid</dt>
      <dd>{c.aidReason}</dd>
      <dt>Heard from</dt>
      <dd>{c.heardFrom}</dd>
      <dt>Acknowledged</dt>
      <dd>
        new to hack club ✓ · aid is once only ✓ · video covers team + startup ✓
      </dd>
      <dt>Submitted</dt>
      <dd>{fmt(app.createdAt)}</dd>
    </dl>
  );
}
