"use client";

import { useState, useTransition } from "react";
import {
  dissolveTeamAction,
  formTeamAction,
  kickPartnerAction,
  refreshTeamAction,
  replaceInviteAction,
  setFeeModeAction,
  type TeamActionResult,
} from "@/app/apply/team-actions";
import { Button, Field, Panel, TextLink } from "@/components/ui";
import type { FeeMode, TeamView } from "@/lib/teams/service";

const PARTNER_SPOTS = 3;

const FEE_MODES: { mode: FeeMode; label: string; hint: string }[] = [
  {
    mode: "founder_pays",
    label: "I'll pay for everyone",
    hint: "2 hours per person, all from your project. partners don't pay hours.",
  },
  {
    mode: "each_pays",
    label: "Everyone pays for themselves",
    hint: "2 hours each. every partner adds a shipped project of their own (2h+ on their own hackatime, code and demo links, no video).",
  },
];

/**
 * The founder's team: members, the invite link and its actions. Team changes go straight to the
 * server and don't touch the rest of the form. `teamVersion` is sent with the form so submit can
 * tell if the team changed in the meantime.
 */
export function TeamSection({
  step,
  team,
  onTeam,
  appUrl,
  error,
  projectPath = false,
}: {
  step: number;
  team: TeamView | null;
  onTeam: (team: TeamView | null) => void;
  appUrl: string;
  error?: string;
  /** On the project path the founder also picks who pays the fee. */
  projectPath?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const act = (fn: () => Promise<TeamActionResult>) =>
    startTransition(async () => {
      const r = await fn();
      onTeam(r.team);
      setMessage(r.error ?? null);
      setCopied(false);
    });

  const link = team?.inviteToken ? `${appUrl}/join/${team.inviteToken}` : "";
  const partners = team?.members.filter((m) => m.role === "partner") ?? [];
  const eachPays = projectPath && team?.feeMode === "each_pays";

  return (
    <section className="step" aria-labelledby="step-team">
      <h2 className="step-title" id="step-team">
        {step}. Bring your team.
      </h2>
      <input type="hidden" name="teamVersion" value={team ? String(team.version) : ""} />
      <ul className="bullets small">
        <li>add up to {PARTNER_SPOTS} partners. they sign in with hack club through your invite link.</li>
        {projectPath && <li>the fee is 2 hours per person on the team. once you add partners, you choose who pays it.</li>}
        <li>your team locks when you submit. applying solo? skip this step.</li>
      </ul>

      {(error || message) && (
        <p className="field-error" role="alert" data-testid="team-error">
          {error ?? message}
        </p>
      )}

      {!team ? (
        <div>
          <Button type="button" variant="quiet" disabled={pending} onClick={() => act(formTeamAction)}>
            Add partners
          </Button>
        </div>
      ) : (
        <Panel className="stack-sm">
          <ul className="team-list" aria-label="Team members">
            {team.members.map((m) => (
              <li key={m.userId} className="panel-row">
                <span>
                  {m.name}
                  <span className="small muted"> · {m.role === "founder" ? "founder (you)" : "partner"}</span>
                  {eachPays && m.role === "partner" && (
                    <span className="small muted" data-testid={`ready-${m.userId}`}>
                      {" "}
                      · {team.readyPartnerIds.includes(m.userId) ? "project added ✓" : "no project yet"}
                    </span>
                  )}
                </span>
                {m.role === "partner" && (
                  <TextLink
                    tone="danger"
                    disabled={pending}
                    onClick={() => act(() => kickPartnerAction(m.userId))}
                    aria-label={`Remove ${m.name}`}
                  >
                    Remove
                  </TextLink>
                )}
              </li>
            ))}
          </ul>
          {projectPath && (
            <fieldset className="stack-sm" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="field-label" style={{ marginBottom: 6 }}>
                Who pays the fee?
              </legend>
              {FEE_MODES.map((o) => (
                <label key={o.mode} className="panel check" style={{ padding: "10px 12px" }}>
                  <input
                    type="radio"
                    name="feeModeChoice"
                    value={o.mode}
                    checked={team.feeMode === o.mode}
                    disabled={pending}
                    onChange={() => act(() => setFeeModeAction(o.mode))}
                  />
                  <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span>{o.label}</span>
                    <span className="small muted">{o.hint}</span>
                  </span>
                </label>
              ))}
              {eachPays && partners.length > 0 && (
                <p className="small muted">
                  each partner adds their project from their own account. use &ldquo;check who joined&rdquo; to see who&apos;s
                  ready.
                </p>
              )}
            </fieldset>
          )}
          <p className="small muted" data-testid="spots-left">
            {team.partnerSpotsLeft === 0
              ? "your team is full."
              : `${team.partnerSpotsLeft} of ${PARTNER_SPOTS} partner spots left.`}
          </p>

          <Field
            id="invite-link"
            label="Invite link"
            readOnly
            value={link}
            hint="send this to your partners. anyone with it can join until your team is full."
            onFocus={(e) => e.currentTarget.select()}
          />
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Button
              type="button"
              variant="quiet"
              onClick={() => {
                void navigator.clipboard?.writeText(link).then(() => setCopied(true));
              }}
            >
              {copied ? "Copied" : "Copy link"}
            </Button>
            <Button type="button" variant="quiet" disabled={pending} onClick={() => act(replaceInviteAction)}>
              New link
            </Button>
            <Button type="button" variant="quiet" disabled={pending} onClick={() => act(refreshTeamAction)}>
              Check who joined
            </Button>
          </div>
          <p className="small muted">a new link stops the old one from working. removing someone also makes a new link.</p>
          {partners.length === 0 && (
            <div>
              <TextLink disabled={pending} onClick={() => act(dissolveTeamAction)}>
                Apply solo instead
              </TextLink>
            </div>
          )}
        </Panel>
      )}
    </section>
  );
}
