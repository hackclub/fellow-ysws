"use client";

import { useActionState, useState } from "react";
import { decideAction, type DecideState } from "@/app/admin/actions";
import { Button, TextArea } from "@/components/ui";

type Value = "approve" | "reject_cut" | "reject_malformed" | "reject_fraud";

// Mirrors DECISION_RULES in src/lib/admin/service.ts, which enforces them.
const OPTIONS: { value: Value; label: string; hint: string; note: "required" | "optional" | "none"; justification: boolean }[] = [
  {
    value: "approve",
    label: "Approve",
    hint: "admission letter, with your note if you add one. synced to airtable.",
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
    hint: "bans them from the program for good. no letter, not synced.",
    note: "none",
    justification: true,
  },
];

const JUSTIFICATION_HINT: Partial<Record<Value, string>> = {
  approve: "internal. goes to airtable with the project: what they built and why the hours hold up.",
  reject_cut: "internal. goes to airtable with the project: why it didn't make the cut.",
  reject_fraud: "internal, kept for the record. what you found.",
};

export function DecisionForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<DecideState, FormData>(decideAction, null);
  const [decision, setDecision] = useState<Value | "">("");
  const [note, setNote] = useState("");
  const [justification, setJustification] = useState("");
  const rules = OPTIONS.find((o) => o.value === decision);
  const ready =
    !!rules &&
    (rules.note !== "required" || note.trim() !== "") &&
    (!rules.justification || justification.trim() !== "");

  return (
    <form action={action} className="panel stack">
      <input type="hidden" name="id" value={id} />
      <fieldset className="stack-sm" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field-label" style={{ marginBottom: 6 }}>Decision</legend>
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
      {rules?.justification && (
        <TextArea
          label="Justification (required)"
          name="justification"
          rows={4}
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          hint={JUSTIFICATION_HINT[rules.value]}
        />
      )}
      {state?.error && <p className="field-error" role="alert">{state.error}</p>}
      <div>
        <Button type="submit" disabled={!ready || pending}>
          {pending ? "Saving…" : "Record decision"}
        </Button>
      </div>
      <p className="small muted">decisions are final.</p>
    </form>
  );
}
