"use client";

import { useActionState } from "react";
import { syncAirtableAction, type SyncState } from "@/app/admin/actions";
import { Button } from "@/components/ui";

/** Pushes approved and cut project reviews to the YSWS Airtable table. */
export function AirtableSync({ waiting, configured }: { waiting: number; configured: boolean }) {
  const [state, action, pending] = useActionState<SyncState, FormData>(syncAirtableAction, null);
  return (
    <form action={action} className="panel stack-sm" data-testid="airtable-sync">
      <div className="panel-row" style={{ alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <span>
          <span className="caps">Airtable</span>{" "}
          <span className="small muted" data-testid="airtable-waiting">
            {configured
              ? waiting === 0
                ? "· up to date"
                : `· ${waiting} review${waiting === 1 ? "" : "s"} waiting`
              : "· not set up (AIRTABLE_PAT, AIRTABLE_APP_NAME, AIRTABLE_TABLE_NAME)"}
          </span>
        </span>
        <Button type="submit" disabled={!configured || pending}>
          {pending ? "Syncing…" : "Sync to Airtable"}
        </Button>
      </div>
      <p className="small muted">approved and didn&apos;t-make-the-cut project reviews only. aid, needs changes and fraud never sync.</p>
      {state && (
        <p className={state.tone === "error" ? "field-error" : "small"} role="status" data-testid="airtable-result">
          {state.message}
        </p>
      )}
    </form>
  );
}
