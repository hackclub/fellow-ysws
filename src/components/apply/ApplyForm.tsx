"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { formStartedAction, submitAction, type SubmitState } from "@/app/apply/actions";
import { Button, Checkbox, Field, Panel, TextArea } from "@/components/ui";
import { missingItems, type ApplicationInput } from "@/lib/applications/shared";
import { coversFee, feeSeconds, formatHours } from "@/lib/hackatime-shared";
import type { TeamView } from "@/lib/teams/service";
import { ProjectPicker, type ProjectsState } from "./ProjectPicker";
import { TeamSection } from "./TeamSection";

const EXAMPLE_VIDEOS_URL =
  "https://www.youtube.com/watch?v=RJsPYnx4av4&list=PLK7HoSSSROuL9e1bdG_oGEo-jSPuOjw6X";

type Values = Required<Omit<ApplicationInput, "kind">>;

const EMPTY: Values = {
  hackatimeProject: "",
  codeUrl: "",
  playableUrl: "",
  description: "",
  heardFrom: "",
  videoUrl: "",
  aidReason: "",
  ackNewToHackClub: false,
  ackOnceOnly: false,
  ackVideoContents: false,
};

export function ApplyForm({
  projects,
  aidAvailable,
  defaultAid = false,
  team: initialTeam = null,
  appUrl = "",
}: {
  projects: ProjectsState;
  aidAvailable: boolean;
  defaultAid?: boolean;
  team?: TeamView | null;
  appUrl?: string;
}) {
  const [state, action, pending] = useActionState<SubmitState, FormData>(submitAction, null);
  const [team, setTeam] = useState<TeamView | null>(initialTeam);
  // When submit finds the team changed, it sends back the current team to review.
  const [seenState, setSeenState] = useState<SubmitState>(null);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.team !== undefined) setTeam(state.team);
  }
  const [aid, setAid] = useState(defaultAid && aidAvailable);
  const [v, setV] = useState<Values>(EMPTY);
  const [started, setStarted] = useState(false);

  // Record "form started" once, the first time the applicant interacts (deduped server-side too).
  useEffect(() => {
    if (started) void formStartedAction();
  }, [started]);

  // The fee is 2 hours per person on the team, founder included. Either the founder pays all of it,
  // or ("each pays") everyone pays their own 2 hours and the founder's project only covers theirs.
  const teamSize = team?.members.length ?? 1;
  const eachPays = !!team && team.feeMode === "each_pays" && teamSize > 1;
  const payingFor = eachPays ? 1 : teamSize;
  const feeHours = feeSeconds(payingFor) / 3600;
  const waitingPartners = eachPays
    ? team.members.filter((m) => m.role === "partner" && !team.readyPartnerIds.includes(m.userId))
    : [];
  const selected = projects.status === "ok" ? projects.projects.find((p) => p.name === v.hackatimeProject) : undefined;
  // A project that stops covering the fee when the team grows is deselected, so it shows up as missing.
  if (selected && !coversFee(selected, payingFor)) setV((prev) => ({ ...prev, hackatimeProject: "" }));

  const errors = state?.errors ?? {};
  const kind = aid ? "aid" : "project";
  const missing = [
    ...missingItems({ kind, ...v }),
    ...(aid ? [] : waitingPartners.map((m) => `${m.name}'s project`)),
  ];

  const touch = () => setStarted(true);
  const set = <K extends keyof Values>(key: K) => (value: Values[K]) => {
    touch();
    setV((prev) => ({ ...prev, [key]: value }));
  };
  const text = (key: keyof Values) => ({
    name: key,
    value: v[key] as string,
    onChange: (e: { target: { value: string } }) => set(key)(e.target.value as never),
    error: errors[key],
  });
  const ack = (key: "ackNewToHackClub" | "ackOnceOnly" | "ackVideoContents") => ({
    name: key,
    checked: v[key],
    onChange: (e: { target: { checked: boolean } }) => set(key)(e.target.checked),
    error: errors[key],
  });

  return (
    <form
      // Submitting through onSubmit (not `action`) skips React's automatic form reset, so a
      // refused submission keeps every answer, checkboxes included.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="stack narrow"
      style={{ gap: 40 }}
      noValidate
    >
      <input type="hidden" name="kind" value={kind} />

      <section className="stack-sm" aria-label="Application type">
        <Checkbox
          name="requestAid"
          checked={aid}
          disabled={!aidAvailable}
          onChange={(e) => {
            touch();
            setAid(e.target.checked);
          }}
        >
          <strong className="caps" style={{ fontWeight: 400 }}>
            Request financial aid
          </strong>
          <span className="muted">
            {" "}
            — apply without a hackatime project.
          </span>
        </Checkbox>
        <p className="small muted" id="aid-explainer">
          {aidAvailable
            ? "aid is for people entirely new to hack club with a crazy idea, not for anyone who just doesn't want to pay. you can only ask for aid once."
            : "you've already used your one financial aid request, so apply with a project instead."}
        </p>
      </section>

      {!aid ? (
        <>
          <section className="step" aria-labelledby="step-1">
            <h2 className="step-title" id="step-1">
              1. Pick a project you&apos;ve built.
            </h2>
            <ul className="bullets small">
              <li>it doesn&apos;t have to be your startup. anything you&apos;ve shipped counts.</li>
              <li>we list hackatime projects with at least 2 hours logged.</li>
              {eachPays ? (
                <li>everyone on your team pays their own 2 hours, so your project only needs 2 hours.</li>
              ) : (
                <li>
                  the project pays 2 hours for each person on your team, so it needs at least {feeHours} hours
                  {teamSize > 1 ? ` for a team of ${teamSize}` : ""}.
                </li>
              )}
            </ul>
            <ProjectPicker
              state={projects}
              value={v.hackatimeProject}
              onChange={set("hackatimeProject")}
              error={errors.hackatimeProject}
              teamSize={payingFor}
            />
          </section>

          <section className="step" aria-labelledby="step-2">
            <h2 className="step-title" id="step-2">
              2. Show us the project.
            </h2>
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
          </section>

          <section className="step" aria-labelledby="step-3">
            <h2 className="step-title" id="step-3">
              3. Record a 1 minute video.
            </h2>
            <ul className="bullets small">
              <li>who&apos;s on the team.</li>
              <li>at a high level, what your startup is about.</li>
              <li>upload it to youtube as unlisted, then paste the link.</li>
            </ul>
            <p className="small">
              not sure what it should look like?{" "}
              <a className="text-link" href={EXAMPLE_VIDEOS_URL} target="_blank" rel="noopener noreferrer">
                watch some example videos from YC founders
              </a>
              .
            </p>
            <Field
              label="YouTube link"
              placeholder="https://youtu.be/…"
              inputMode="url"
              hint="set the video to unlisted, not private, so we can watch it."
              {...text("videoUrl")}
            />
          </section>

          <TeamSection step={4} team={team} onTeam={setTeam} appUrl={appUrl} error={errors.team} projectPath />

          <section className="step" aria-labelledby="step-5">
            <h2 className="step-title" id="step-5">
              5. Pay the application fee: {eachPays ? "2 hours™ each" : `${feeHours} hours™`}.
            </h2>
            <p>we don&apos;t take money. we take time.</p>
            <Panel className="stack-sm">
              <div className="panel-row">
                <span>{eachPays ? "Your share" : "Application fee"}</span>
                <span>{feeHours} hours</span>
              </div>
              {eachPays &&
                team.members
                  .filter((m) => m.role === "partner")
                  .map((m) => (
                    <div className="panel-row" key={m.userId} data-testid={`fee-${m.userId}`}>
                      <span>
                        {m.name}
                        <span className="small muted">
                          {" "}
                          · {team.readyPartnerIds.includes(m.userId) ? "ready" : "not ready yet"}
                        </span>
                      </span>
                      <span>2 hours, from their own project</span>
                    </div>
                  ))}
              <p className="small muted">
                {eachPays
                  ? `2 hours × ${teamSize} people, each from their own project.`
                  : teamSize > 1
                    ? `2 hours × ${teamSize} people. only you pay; partners don't.`
                    : "2 hours for you. each partner you add adds 2 hours. you can pay for them, or have them pay for themselves."}
              </p>
              <p className="small muted">
                {selected
                  ? `charged against ${selected.name} (${formatHours(selected.totalSeconds)} logged).`
                  : "pick a project above to pay with."}
              </p>
            </Panel>
            <ul className="bullets small">
              <li>
                fellows fund™ only takes {feeHours} hours of credit from {eachPays ? "each project" : "your project"}, not the
                full amount.
              </li>
              <li>the rest of {eachPays ? "each" : "that"} project&apos;s hours are still yours to reship to another program.</li>
            </ul>
          </section>
        </>
      ) : (
        <>
          <section className="step" aria-labelledby="aid-1">
            <h2 className="step-title" id="aid-1">
              1. Record a 1 minute video.
            </h2>
            <ul className="bullets small">
              <li>who&apos;s on the team.</li>
              <li>at a high level, what your startup is about.</li>
              <li>upload it to youtube as unlisted, then paste the link.</li>
            </ul>
            <p className="small">
              not sure what it should look like?{" "}
              <a className="text-link" href={EXAMPLE_VIDEOS_URL} target="_blank" rel="noopener noreferrer">
                watch some example videos that got in
              </a>
              .
            </p>
            <Field
              label="YouTube link"
              placeholder="https://youtu.be/…"
              inputMode="url"
              hint="set the video to unlisted, not private, so we can watch it."
              {...text("videoUrl")}
            />
          </section>

          <section className="step" aria-labelledby="aid-2">
            <h2 className="step-title" id="aid-2">
              2. Tell us why you need aid.
            </h2>
            <TextArea
              label="Why are you asking for financial aid?"
              placeholder="where you're starting from, and why this idea can't wait"
              rows={5}
              {...text("aidReason")}
            />
            <Field label="How'd you hear about us?" placeholder="slack, a friend, a poster…" {...text("heardFrom")} />
          </section>

          <TeamSection step={3} team={team} onTeam={setTeam} appUrl={appUrl} error={errors.team} />

          <section className="step" aria-labelledby="aid-4">
            <h2 className="step-title" id="aid-4">
              4. The fine print.
            </h2>
            <Checkbox {...ack("ackNewToHackClub")}>
              i&apos;m entirely new to hack club with a crazy idea. aid isn&apos;t for people who just don&apos;t want to
              pay.
            </Checkbox>
            <Checkbox {...ack("ackOnceOnly")}>
              i understand i can only ask for financial aid once, even if i delete this application.
            </Checkbox>
            <Checkbox {...ack("ackVideoContents")}>
              my video is about 1 minute and shows the team behind the idea and, at a high level, what the startup is about.
            </Checkbox>
          </section>
        </>
      )}

      <div className="submit-row">
        {errors.form && (
          <p className="field-error" role="alert">
            {errors.form}
          </p>
        )}
        <Button type="submit" disabled={missing.length > 0 || pending}>
          {pending ? "Submitting…" : aid ? "Submit application" : `Pay ${feeHours} hours & submit`}
        </Button>
        {missing.length > 0 && (
          <p className="small muted" data-testid="still-missing">
            still missing: {missing.join(", ")}.
          </p>
        )}
      </div>
    </form>
  );
}
