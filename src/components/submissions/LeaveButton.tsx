"use client";

import { useState } from "react";
import { leaveAction } from "@/app/submissions/actions";
import { Button, TextLink } from "@/components/ui";

export function LeaveButton() {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <TextLink tone="danger" onClick={() => setConfirming(true)}>
        Leave team
      </TextLink>
    );
  }
  return (
    <form action={leaveAction} className="panel stack-sm">
      <p>leave this team? you&apos;d need a new invite link from the founder to rejoin.</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Button type="submit">Yes, leave</Button>
        <Button type="button" variant="quiet" onClick={() => setConfirming(false)}>
          Stay
        </Button>
      </div>
    </form>
  );
}
