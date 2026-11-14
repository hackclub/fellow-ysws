import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { applications, users } from "@/db/schema";
import { encrypt, hcIdHash } from "@/lib/crypto";
import { piiBinding } from "@/lib/auth/session";
import type { ApplicationInput, ApplicationStatus } from "@/lib/applications/shared";
import { noteBinding } from "@/lib/applications/service";

export async function makeUser(hcId = `ident!${randomUUID().slice(0, 8)}`) {
  const id = randomUUID();
  await db()
    .insert(users)
    .values({ id, hcIdHash: hcIdHash(hcId), piiEnc: encrypt({ hcId, name: `Name ${hcId}`, email: `${hcId}@x.dev`, slackId: null }, piiBinding(id)) });
  return { id, hcId };
}

export const projectInput: ApplicationInput = {
  kind: "project",
  hackatimeProject: "big-project",
  codeUrl: "https://github.com/orpheus/big-project",
  playableUrl: "https://big-project.example.com",
  description: "PLAINTEXT-DESCRIPTION",
  videoUrl: "https://youtu.be/dQw4w9WgXcQ",
  heardFrom: "slack",
};

export const aidInput: ApplicationInput = {
  kind: "aid",
  videoUrl: "https://youtu.be/dQw4w9WgXcQ",
  aidReason: "PLAINTEXT-AID-REASON",
  heardFrom: "a friend",
  ackNewToHackClub: true,
  ackOnceOnly: true,
  ackVideoContents: true,
};

/** Directly records a decision (the admin service is tested separately). */
export async function forceDecision(appId: string, status: Exclude<ApplicationStatus, "submitted">, adminId: string) {
  await db()
    .update(applications)
    .set({
      status,
      decidedAt: new Date(),
      decidedByUserId: adminId,
      noteEnc: status === "approved" ? null : encrypt("PLAINTEXT-NOTE", noteBinding(appId)),
    })
    .where(eq(applications.id, appId));
}
