"use client";

import { useActionState, useState } from "react";
import { decideAction, type DecideState } from "@/app/admin/actions";
import { Button, TextArea } from "@/components/ui";
import type { Member } from "@/lib/teams/service";

type Value = "approve" | "select" | "reject_cut" | "reject_malformed" | "reject_fraud";
type Option = { value: Value; label: string; hint: string; note: "required" | "optional" | "none"; justification: boolean };

// Mirrors DECISION_RULES in src/lib/admin/service.ts, which enforces them.
const ROUND_1: Option[] = [
  {
    value: "approve",
    label: "Approve",
    hint: "invites them to a second-round interview, with your note if you add one. synced to airtable.",
    note: "optional",
    justification: true,
  },
  {
    value: "reject_cut",
    label: "Reject — didn't make the cut",
    hint: "rejection letter with your note; they can reapply. synced to airtable.",
    note: "required",
    justification: true,
  },
  {
    value: "reject_malformed",
    label: "Needs changes",
    hint: "returns it with your note so they can fix and resubmit. not synced.",
    note: "required",
    justification: false,
  },
  {
    value: "reject_fraud",
    label: "Reject — fraud",
    hint: "rejects the whole team and bans one person from the program for good. no letter, not synced.",
    note: "none",
    justification: true,
  },
];

/** After the interview. The project already went to Airtable at the invite, so nothing here syncs. */
const ROUND_2: Option[] = [
  {
    value: "select",
    label: "Select",
    hint: "admission letter: they're in. your note is optional.",
    note: "optional",
    justification: true,
  },
  {
    value: "reject_cut",
    label: "Reject — didn't make the cut",
    hint: "rejection letter with your note; they can reapply.",
    note: "required",
    justification: true,
  },
  {
    value: "reject_fraud",
    label: "Reject — fraud",
    hint: "rejects the whole team and bans one person from the program for good. no letter.",
    note: "none",
    justification: true,
  },
];

const JUSTIFICATION_HINT: Partial<Record<Value, string>> = {
  approve: "internal. goes to airtable with the project: what they built and why the hours hold up.",
  reject_cut: "internal. goes to airtable with the project: why it didn't make the cut.",
  reject_fraud: "internal, kept for the record. what you found.",
};

const JUSTIFICATION_HINT_ROUND_2: Partial<Record<Value, string>> = {
  select: "internal, not synced. how the interview went.",
  reject_cut: "internal, not synced. why they didn't make it after the interview.",
  reject_fraud: "internal, kept for the record. what you found.",
};

export function DecisionForm({ id, members = [], round = 1 }: { id: string; members?: Member[]; round?: 1 | 2 }) {
  const OPTIONS = round === 1 ? ROUND_1 : ROUND_2;
  const [state, action, pending] = useActionState<DecideState, FormData>(decideAction, null);
  const [decision, setDecision] = useState<Value | "">("");
  const [note, setNote] = useState("");
  const [justification, setJustification] = useState("");
  const founder = members.find((m) => m.role === "founder");
  const [banUserId, setBanUserId] = useState(founder?.userId ?? "");
  const rules = OPTIONS.find((o) => o.value === decision);
  const ready =
    !!rules &&
    (rules.note !== "required" || note.trim() !== "") &&
    (!rules.justification || justification.trim() !== "");

  return (
    <form action={action} className="panel stack">
      <input type="hidden" name="id" value={id} />
      <fieldset className="stack-sm" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field-label" style={{ marginBottom: 6 }}>
          {round === 1 ? "Decision" : "Decision after the interview"}
        </legend>
        {OPTIONS.map((o) => (
          <label key={o.value} className="check">
            <input type="radio" name="decision" value={o.value} checked={decision === o.value} onChange={() => setDecision(o.value)} />
            <span>
              <span className="caps">{o.label}</span> <span className="muted small">— {o.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {rules && rules.note !== "none" && (
        <TextArea
          label={rules.note === "required" ? "Note to the applicant (required)" : "Note to the applicant (optional)"}
          name="note"
          rows={4}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          hint={decision === "reject_malformed" ? "they'll see this on their submission page." : "they'll see this in their decision letter."}
        />
      )}
      {decision === "reject_fraud" && members.length > 1 && (
        <fieldset className="stack-sm" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field-label" style={{ marginBottom: 6 }}>Who to ban</legend>
          {members.map((m) => (
            <label key={m.userId} className="check">
              <input
                type="radio"
                name="banUserId"
                value={m.userId}
                checked={banUserId === m.userId}
                onChange={() => setBanUserId(m.userId)}
              />
              <span>
                {m.name} <span className="muted small">— {m.role}</span>
              </span>
            </label>
          ))}
          <p className="small muted">the whole application is rejected either way. only this person is banned.</p>
        </fieldset>
      )}
      {rules?.justification && (
        <TextArea
          label="Justification (required)"
          name="justification"
          rows={4}
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          hint={(round === 1 ? JUSTIFICATION_HINT : JUSTIFICATION_HINT_ROUND_2)[rules.value]}
        />
      )}
      {state?.error && <p className="field-error" role="alert">{state.error}</p>}
      <div>
        <Button type="submit" disabled={!ready || pending}>
          {pending ? "Saving…" : "Record decision"}
        </Button>
      </div>
      <p className="small muted">
        {round === 1 ? "approving isn't final: you decide again after the interview. every other decision is final." : "decisions are final."}
      </p>
    </form>
  );
}
