// Pure application rules shared by the form (client) and the server.
import { z } from "zod";

export type ApplicationKind = "project" | "aid";
export type ApplicationStatus = "submitted" | "approved" | "rejected_cut" | "rejected_malformed" | "rejected_fraud";

/** The one place internal statuses become applicant-facing words. */
export const APPLICANT_LABEL: Record<ApplicationStatus, string> = {
  submitted: "Under review",
  approved: "Accepted",
  rejected_cut: "Not accepted",
  rejected_malformed: "Needs changes",
  rejected_fraud: "Not accepted",
};

export const ADMIN_LABEL: Record<ApplicationStatus, string> = {
  submitted: "Pending",
  approved: "Approved",
  rejected_cut: "Rejected — cut",
  rejected_malformed: "Rejected — malformed",
  rejected_fraud: "Rejected — fraud",
};

export type ProjectContent = {
  hackatimeProject: string;
  codeUrl: string;
  playableUrl: string;
  description: string;
  heardFrom: string;
};

export type AidContent = {
  videoUrl: string;
  aidReason: string;
  heardFrom: string;
  acknowledgements: { newToHackClub: true; onceOnly: true; videoContents: true };
};

export type ApplicationContent = ProjectContent | AidContent;

/** Raw form input. Everything is a string or boolean so the client and server share it. */
export type ApplicationInput = {
  kind: ApplicationKind;
  hackatimeProject?: string;
  codeUrl?: string;
  playableUrl?: string;
  description?: string;
  heardFrom?: string;
  videoUrl?: string;
  aidReason?: string;
  ackNewToHackClub?: boolean;
  ackOnceOnly?: boolean;
  ackVideoContents?: boolean;
};

/** `team` is set when the team changed after the form loaded, so the founder can review it. */
export type FieldErrors = Partial<Record<keyof ApplicationInput | "form" | "team", string>>;

const GITHUB_REPO = /^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]+?)(?:\.git)?\/?(?:[/?#].*)?$/;

/** Canonical https://github.com/owner/repo, or null if not a GitHub repository URL. */
export function normalizeGithubRepo(raw: string): string | null {
  const m = GITHUB_REPO.exec(raw.trim());
  if (!m || m[2] === "." || m[2] === "..") return null;
  return `https://github.com/${m[1]}/${m[2]}`;
}

export function isHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

/** Canonical https://www.youtube.com/watch?v=ID for watch, youtu.be, shorts and live URLs; else null. */
export function normalizeYouTubeUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^(www\.|m\.|music\.)/, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = /^\/(?:shorts|live|embed)\/([^/]+)/.exec(u.pathname);
      id = m?.[1] ?? null;
    }
  }
  return id && YT_ID.test(id) ? `https://www.youtube.com/watch?v=${id}` : null;
}

const LIMITS = { description: 2000, aidReason: 3000, heardFrom: 300 } as const;

const text = (label: string, max: number) =>
  z
    .string({ error: `add ${label}` })
    .trim()
    .min(1, `add ${label}`)
    .max(max, `keep ${label} under ${max} characters`);

const projectSchema = z.object({
  kind: z.literal("project"),
  hackatimeProject: z.string({ error: "pick a hackatime project" }).trim().min(1, "pick a hackatime project"),
  codeUrl: z
    .string({ error: "add a code url" })
    .trim()
    .min(1, "add a code url")
    .transform((v, ctx) => {
      const repo = normalizeGithubRepo(v);
      if (!repo) ctx.addIssue({ code: "custom", message: "the code url must be a github repository, like https://github.com/you/project" });
      return repo ?? v;
    }),
  playableUrl: z
    .string({ error: "add a playable url" })
    .trim()
    .min(1, "add a playable url")
    .refine(isHttpUrl, "the playable url must be a link starting with http:// or https://"),
  description: text("a description", LIMITS.description),
  heardFrom: text("how you heard about us", LIMITS.heardFrom),
});

const mustAck = (msg: string) => z.literal(true, { error: msg });

const aidSchema = z.object({
  kind: z.literal("aid"),
  videoUrl: z
    .string({ error: "add your video link" })
    .trim()
    .min(1, "add your video link")
    .transform((v, ctx) => {
      const yt = normalizeYouTubeUrl(v);
      if (!yt) ctx.addIssue({ code: "custom", message: "use a youtube link, with the video set to unlisted" });
      return yt ?? v;
    }),
  aidReason: text("why you're asking for aid", LIMITS.aidReason),
  heardFrom: text("how you heard about us", LIMITS.heardFrom),
  ackNewToHackClub: mustAck("confirm that aid is for people new to hack club"),
  ackOnceOnly: mustAck("confirm that you understand aid is once only"),
  ackVideoContents: mustAck("confirm what your video covers"),
});

export type ValidApplication =
  | { kind: "project"; content: ProjectContent }
  | { kind: "aid"; content: AidContent };

export function validateApplication(
  input: ApplicationInput,
): { ok: true; value: ValidApplication } | { ok: false; errors: FieldErrors } {
  const schema = input.kind === "aid" ? aidSchema : projectSchema;
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const errors: FieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = (issue.path[0] as keyof ApplicationInput | undefined) ?? "form";
      errors[key] ??= issue.message;
    }
    return { ok: false, errors };
  }
  const d = parsed.data;
  if (d.kind === "project") {
    const { kind, ...content } = d;
    return { ok: true, value: { kind, content } };
  }
  return {
    ok: true,
    value: {
      kind: "aid",
      content: {
        videoUrl: d.videoUrl,
        aidReason: d.aidReason,
        heardFrom: d.heardFrom,
        acknowledgements: { newToHackClub: true, onceOnly: true, videoContents: true },
      },
    },
  };
}

/** Plain-word list of what's still missing, for the disabled submit button. */
export function missingItems(input: ApplicationInput): string[] {
  const blank = (v?: string) => !v || v.trim() === "";
  const out: string[] = [];
  if (input.kind === "project") {
    if (blank(input.hackatimeProject)) out.push("a hackatime project");
    if (blank(input.codeUrl)) out.push("a code url");
    if (blank(input.playableUrl)) out.push("a playable url");
    if (blank(input.description)) out.push("a description");
  } else {
    if (blank(input.videoUrl)) out.push("your video link");
    if (blank(input.aidReason)) out.push("why you're asking for aid");
  }
  if (blank(input.heardFrom)) out.push("how you heard about us");
  if (input.kind === "aid") {
    const acks = [input.ackNewToHackClub, input.ackOnceOnly, input.ackVideoContents].filter((a) => !a).length;
    if (acks) out.push(acks === 1 ? "one acknowledgement" : `${acks} acknowledgements`);
  }
  return out;
}
