"use client";

import { coversFee, feeSeconds, formatHours, type HackatimeProject } from "@/lib/hackatime-shared";

export type ProjectsState =
  | { status: "not_connected"; denied?: boolean; failed?: boolean }
  | { status: "error"; message: string; reconnect: boolean }
  | { status: "ok"; projects: HackatimeProject[] };

export function ProjectPicker({
  state,
  value,
  onChange,
  error,
  teamSize = 1,
}: {
  state: ProjectsState;
  value: string;
  onChange: (name: string) => void;
  error?: string;
  /** People on the team, founder included. The fee is 2 hours each. */
  teamSize?: number;
}) {
  const feeHours = feeSeconds(teamSize) / 3600;
  const shortNote = `needs ${feeHours}h for a team of ${teamSize}`;
  if (state.status === "not_connected") {
    return (
      <div className="stack-sm">
        {state.denied && (
          <p className="notice" role="status">
            hackatime wasn&apos;t connected. the project path needs it so we can check your hours.
          </p>
        )}
        {state.failed && (
          <p className="notice" role="status">
            something went wrong connecting hackatime. try again.
          </p>
        )}
        <p className="small">connect hackatime so we can list projects with at least 2 hours logged (2 hours per person on your team).</p>
        <div>
          <a className="button" href="/auth/hackatime/start">
            Connect Hackatime
          </a>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="stack-sm" role="alert">
        <p className="notice">{state.message.toLowerCase()}.</p>
        <p>
          {state.reconnect ? (
            <a className="text-link" href="/auth/hackatime/start">
              Reconnect Hackatime
            </a>
          ) : (
            <a className="text-link" href="/apply">
              Try again
            </a>
          )}
        </p>
      </div>
    );
  }

  if (state.projects.length === 0) {
    return (
      <p className="notice" role="status">
        none of your hackatime projects have 2 hours logged yet. keep building, or if you&apos;re brand new to hack club,
        check &ldquo;request financial aid&rdquo; above to apply without a project.
      </p>
    );
  }

  const noneCover = !state.projects.some((p) => coversFee(p, teamSize));

  return (
    <fieldset className="stack-sm" style={{ border: 0, padding: 0, margin: 0 }} aria-describedby={error ? "project-error" : undefined}>
      <legend className="field-label" style={{ marginBottom: 6 }}>
        Hackatime project
      </legend>
      {noneCover && (
        <p className="notice" role="status">
          none of your projects cover {feeHours}h yet. keep building, or remove a partner.
        </p>
      )}
      {state.projects.map((p, i) => {
        const short = !coversFee(p, teamSize);
        const noteId = `project-short-${i}`;
        return (
          <label
            key={p.name}
            className="panel check"
            style={{ alignItems: "center", padding: "10px 12px", opacity: short ? 0.55 : undefined }}
          >
            <input
              type="radio"
              name="hackatimeProject"
              value={p.name}
              checked={!short && value === p.name}
              disabled={short}
              aria-describedby={short ? noteId : undefined}
              onChange={() => onChange(p.name)}
            />
            <span style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span>{p.name}</span>
                {short && (
                  <span className="small muted" id={noteId}>
                    {shortNote}
                  </span>
                )}
              </span>
              <span className="muted">{formatHours(p.totalSeconds)} logged</span>
            </span>
          </label>
        );
      })}
      {error && (
        <p className="field-error" id="project-error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
