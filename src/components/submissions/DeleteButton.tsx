"use client";

import { useState } from "react";
import { deleteAction } from "@/app/submissions/actions";
import { Button, TextLink } from "@/components/ui";

export function DeleteButton({ kind }: { kind: "project" | "aid" }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <TextLink tone="danger" onClick={() => setConfirming(true)}>
        Delete application
      </TextLink>
    );
  }
  return (
    <form action={deleteAction} className="panel stack-sm">
      <p>
        delete this application? this can&apos;t be undone.
        {kind === "aid" && " your one financial aid request stays used, so you could only reapply with a project."}
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Button type="submit">Yes, delete it</Button>
        <Button type="button" variant="quiet" onClick={() => setConfirming(false)}>
          Keep it
        </Button>
      </div>
    </form>
  );
}
