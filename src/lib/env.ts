import { z } from "zod";

const base64Key = z
  .string()
  .refine((v) => Buffer.from(v, "base64").length === 32, "must be 32 bytes, base64-encoded");

const schema = z
  .object({
    DATABASE_URL: z.string().url(),
    APP_URL: z.string().url(),
    HACKCLUB_AUTH_URL: z.string().url().default("https://auth.hackclub.com"),
    HACKATIME_URL: z.string().url().default("https://hackatime.hackclub.com"),
    YOUTUBE_OEMBED_URL: z.string().url().default("https://www.youtube.com/oembed"),
    TELESCREEN_URL: z.string().url().default("https://telescreen.hackclub.com"),
    HACKCLUB_AUTH_EXTRA_SCOPES: z.string().default(""),
    AIRTABLE_API_URL: z.string().url().default("https://api.airtable.com"),
    AIRTABLE_PAT: z.string().optional(),
    /** The base id (app…). */
    AIRTABLE_APP_NAME: z.string().optional(),
    /** The table id (tbl…) or name. */
    AIRTABLE_TABLE_NAME: z.string().optional(),
    HACKCLUB_AUTH_CLIENT_ID: z.string().min(1, "required (see the OAuth apps section of the README)"),
    HACKCLUB_AUTH_CLIENT_SECRET: z.string().min(1, "required (see the OAuth apps section of the README)"),
    HACKATIME_CLIENT_ID: z.string().min(1, "required (see the OAuth apps section of the README)"),
    HACKATIME_CLIENT_SECRET: z.string().min(1, "required (see the OAuth apps section of the README)"),
    /** JSON map of key version -> base64 32-byte key, e.g. {"1":"..."} */
    ENCRYPTION_KEYS: z
      .string()
      .transform((v, ctx) => {
        try {
          return JSON.parse(v) as unknown;
        } catch {
          ctx.addIssue({ code: "custom", message: "must be JSON like {\"1\":\"<base64 key>\"}" });
          return z.NEVER;
        }
      })
      .pipe(z.record(z.string().regex(/^\d+$/, "key versions must be integers"), base64Key)),
    ENCRYPTION_ACTIVE_KEY_VERSION: z.string().regex(/^\d+$/),
    /** HMAC key for identifier lookups. Never rotate: rotating orphans every lookup. */
    LOOKUP_KEY: base64Key,
    /** Comma-separated Hack Club user ids (the OIDC `sub`, e.g. ident!abc123). */
    ADMIN_HACKCLUB_IDS: z.string().default(""),
  })
  .superRefine((env, ctx) => {
    if (!(env.ENCRYPTION_ACTIVE_KEY_VERSION in env.ENCRYPTION_KEYS)) {
      ctx.addIssue({
        code: "custom",
        path: ["ENCRYPTION_ACTIVE_KEY_VERSION"],
        message: "must name a version present in ENCRYPTION_KEYS",
      });
    }
  });

export type Env = z.infer<typeof schema> & { adminIds: ReadonlySet<string> };

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join(".") || "(env)"}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join("\n")}\nSee .env.example.`);
  }
  const adminIds = new Set(
    result.data.ADMIN_HACKCLUB_IDS.split(",").map((s) => s.trim()).filter(Boolean),
  );
  return { ...result.data, adminIds };
}

let cached: Env | undefined;

/** Validated environment. Throws a readable error listing every bad variable. */
export function env(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

/** For tests only. */
export function resetEnvCache() {
  cached = undefined;
}
