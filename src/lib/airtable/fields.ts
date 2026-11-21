// Maps a reviewed project application onto the YSWS Project Submission table (by field name).
// Pure, so it can be unit tested. See docs/airtable.md for the table's fields.
import type { UserPii } from "@/lib/auth/session";
import type { ProjectContent } from "@/lib/applications/shared";
import { normalizeGithubRepo } from "@/lib/applications/shared";

export type FieldInput = {
  content: ProjectContent;
  pii: UserPii;
  hackatimeId: string | null;
  loggedSeconds: number;
  /** The most hours we report, in seconds (the 2 hours the program credits). */
  cappedSeconds: number;
  submittedAt: Date;
  justification: string | null;
};

const hours = (seconds: number) => Math.round((seconds / 3600) * 100) / 100;

/** First and last name: Hack Club Auth's given/family name, else split the full name. */
export function splitName(pii: UserPii): { first: string | null; last: string | null } {
  if (pii.givenName || pii.familyName) return { first: pii.givenName ?? null, last: pii.familyName ?? null };
  const parts = (pii.name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: null, last: null };
  return { first: parts[0], last: parts.slice(1).join(" ") || null };
}

/** True when the user has a mailing address we can ship to (YSWS needs one on every record). */
export function hasMailingAddress(pii: UserPii): boolean {
  const a = pii.address;
  return Boolean(a?.line1 && a.city && a.country);
}

/** The repository owner from a GitHub code URL. */
export function githubOwner(codeUrl: string): string | null {
  const repo = normalizeGithubRepo(codeUrl);
  return repo ? new URL(repo).pathname.split("/")[1] || null : null;
}

export function buildFields(input: FieldInput): Record<string, string | number> {
  const { content, pii, hackatimeId, justification } = input;
  const name = splitName(pii);
  const day = input.submittedAt.toISOString().slice(0, 10);
  const logged = hours(input.loggedSeconds);
  const reported = hours(Math.min(input.loggedSeconds, input.cappedSeconds));

  // When the override justification is set, the table's "Automation - Unified Justification"
  // formula uses it alone, so it carries the Hackatime details and the reviewer's reasoning too.
  const overrideJustification = [
    `Hackatime ID: ${hackatimeId ?? "unknown"}`,
    `Hackatime project: ${content.hackatimeProject} (${logged}h logged as of ${day})`,
    `Hours capped at ${hours(input.cappedSeconds)}h, the time FELLOWS FUND™ credits for a project application.`,
    ...(justification ? ["", "Reviewer justification:", justification] : []),
  ].join("\n");

  const fields: Record<string, string | number | null> = {
    "Code URL": content.codeUrl,
    "Playable URL": content.playableUrl,
    "How did you hear about this?": content.heardFrom,
    "First Name": name.first,
    "Last Name": name.last,
    Email: pii.email,
    Description: content.description,
    "GitHub Username": githubOwner(content.codeUrl),
    "Address (Line 1)": pii.address?.line1 ?? null,
    "Address (Line 2)": pii.address?.line2 ?? null,
    City: pii.address?.city ?? null,
    "State / Province": pii.address?.state ?? null,
    Country: pii.address?.country ?? null,
    "ZIP / Postal Code": pii.address?.postalCode ?? null,
    Birthday: pii.birthdate ?? null,
    "Optional - Override Hours Spent": reported,
    "Optional - Override Hours Spent Justification": overrideJustification,
    "Justification - Hackatime Project Name(s) + Date Range(s)": `${content.hackatimeProject} (all time, through ${day})`,
    "Justification - Submitter Hackatime ID": hackatimeId,
    "Justification - Additional Justification": justification,
  };
  // Leave unknown fields out rather than sending nulls.
  return Object.fromEntries(Object.entries(fields).filter((e): e is [string, string | number] => e[1] !== null && e[1] !== ""));
}
