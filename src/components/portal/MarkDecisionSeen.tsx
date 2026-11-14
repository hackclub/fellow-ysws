"use client";

import { useEffect } from "react";
import { markDecisionSeenAction } from "@/app/submissions/actions";

/** Records that the letter was opened, so the portal shows the next step afterwards. */
export function MarkDecisionSeen() {
  useEffect(() => {
    void markDecisionSeenAction();
  }, []);
  return null;
}
