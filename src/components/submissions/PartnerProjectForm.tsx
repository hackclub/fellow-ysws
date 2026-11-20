"use client";

import { startTransition, useActionState, useState } from "react";
import { savePartnerProjectAction, type PartnerProjectState } from "@/app/submissions/project-actions";
import { ProjectPicker, type ProjectsState } from "@/components/apply/ProjectPicker";
import { Button, Field, TextArea } from "@/components/ui";
import type { PartnerProjectContent } from "@/lib/applications/shared";
import { formatHours } from "@/lib/hackatime-shared";

type Values = PartnerProjectContent;

const EMPTY: Values = { hackatimeProject: "", codeUrl: "", playableUrl: "", description: "", heardFrom: "" };

const MISSING: [keyof Values, string][] = [
  ["hackatimeProject", "a hackatime project"],
  ["codeUrl", "a code url"],
  ["playableUrl", "a playable url"],
  ["description", "a description"],
  ["heardFrom", "how you heard about us"],
];

/**
 * A partner's own shipped project for "everyone pays for themselves": the project fields without
 * a video. Saving re-reads their hours from Hackatime.
 */
export function PartnerProjectForm({
  founderName,
  projects,
  saved,
}: {
  founderName: string;
  projects: ProjectsState;
  saved: { content: PartnerProjectContent; seconds: number } | null;
}) {
  const [state, action, pending] = useActionState<PartnerProjectState, FormData>(savePartnerProjectAction, null);
  const [v, setV] = useState<Values>(saved?.content ?? EMPTY);
  const errors = state?.errors ?? {};
  const missing = MISSING.filter(([k]) => v[k].trim() === "").map(([, label]) => label);
  const text = (key: keyof Values) => ({
    name: key,
    value: v[key],
    onChange: (e: { target: { value: string } }) => setV((prev) => ({ ...prev, [key]: e.target.value })),
    error: errors[key],
  });

  return (
    <section className="stack" aria-labelledby="partner-project-heading">
      <h2 id="partner-project-heading">Your project.</h2>
      <ul className="bullets small">
        <li>{founderName} chose &ldquo;everyone pays for themselves&rdquo;, so you pay your own 2 hours™.</li>
        <li>pick a project you&apos;ve shipped, with at least 2 hours on your own hackatime. it doesn&apos;t have to be the startup.</li>
        <li>no video needed. {founderName} handles that.</li>
      </ul>
      {saved && (
        <p className="notice" role="status" data-testid="partner-project-saved">
          saved: {saved.content.hackatimeProject} ({formatHours(saved.seconds)} logged). you&apos;re ready. saving again
          rechecks your hours.
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          startTransition(() => action(data));
        }}
        className="stack"
        noValidate
      >
        <ProjectPicker
          state={projects}
          value={v.hackatimeProject}
          onChange={(name) => setV((prev) => ({ ...prev, hackatimeProject: name }))}
          error={errors.hackatimeProject}
          returnTo="/submissions"
        />
        <Field label="Code URL" placeholder="https://github.com/you/project" inputMode="url" {...text("codeUrl")} />
        <Field
          label="Playable URL"
          placeholder="https://… somewhere we can try it"
          inputMode="url"
          hint="a live site, a demo, a download page — anything we can actually use."
          {...text("playableUrl")}
        />
        <TextArea label="Description" placeholder="what it is, who it's for, what you're proud of" {...text("description")} />
        <Field label="How'd you hear about us?" placeholder="slack, a friend, a poster…" {...text("heardFrom")} />
        {errors.form && (
          <p className="field-error" role="alert">
            {errors.form}
          </p>
        )}
        <div>
          <Button type="submit" disabled={missing.length > 0 || pending}>
            {pending ? "Saving…" : saved ? "Update my project" : "Save my project"}
          </Button>
        </div>
        {missing.length > 0 && (
          <p className="small muted" data-testid="partner-still-missing">
            still missing: {missing.join(", ")}.
          </p>
        )}
      </form>
    </section>
  );
}
