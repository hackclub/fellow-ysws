import { sql } from "drizzle-orm";
import { SECONDS_PER_APPLICANT } from "../lib/hackatime-shared";
import {
  bigserial,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// Columns ending in `_enc` hold AES-256-GCM ciphertext (see src/lib/crypto.ts).
// Everything else is operational metadata and stays in plaintext.

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  hcIdHash: text("hc_id_hash").notNull().unique(),
  /** { hcId, name, email, slackId } */
  piiEnc: text("pii_enc").notNull(),
  hackatimeConnectedAt: timestamp("hackatime_connected_at", { withTimezone: true }),
  /** The user's Hackatime account id, from the latest Hackatime connection. */
  hackatimeIdEnc: text("hackatime_id_enc"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    idHash: text("id_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const applicationKind = pgEnum("application_kind", ["project", "aid"]);
export const applicationStatus = pgEnum("application_status", [
  "submitted",
  /** Passed the first review; waiting on a second-round interview before the final decision. */
  "interview",
  "approved",
  "rejected_cut",
  "rejected_malformed",
  "rejected_fraud",
]);

/** One person's share of the fee. A project application credits a positive multiple of it. */
export const CREDITED_SECONDS = SECONDS_PER_APPLICANT;

/** Founder plus up to 3 partners. */
export const TEAM_MAX_MEMBERS = 4;

export const teamRole = pgEnum("team_role", ["founder", "partner"]);

/** Who pays the project-path fee: the founder for everyone, or each person from their own project. */
export const feeMode = pgEnum("fee_mode", ["founder_pays", "each_pays"]);

/**
 * A founder's team, formed before submit. Open while `locked_at` and `dissolved_at` are NULL.
 * `version` bumps on every membership or invite-link change so submit can detect a stale form.
 */
export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey(),
    founderUserId: uuid("founder_user_id")
      .notNull()
      .references(() => users.id),
    /** Keyed hash of the invite token, for lookup. */
    inviteTokenHash: text("invite_token_hash").notNull().unique(),
    /** The invite token itself, encrypted so the founder can see the link again. */
    inviteTokenEnc: text("invite_token_enc").notNull(),
    version: integer("version").notNull().default(0),
    feeMode: feeMode("fee_mode").notNull().default("founder_pays"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    dissolvedAt: timestamp("dissolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("teams_founder_idx").on(t.founderUserId)],
);

/** Live team membership. Rows are released (never deleted) so history survives. */
export const teamMembers = pgTable(
  "team_members",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    role: teamRole("role").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    /** A partner's own project for "each pays" mode (PartnerProjectContent). Kept across mode switches. */
    projectEnc: text("project_enc"),
    /** The project's logged time when the partner saved it. */
    projectSeconds: integer("project_seconds"),
    /** The partner's Hackatime account id when they saved it. */
    projectHackatimeIdEnc: text("project_hackatime_id_enc"),
    projectSavedAt: timestamp("project_saved_at", { withTimezone: true }),
  },
  (t) => [
    check(
      "team_members_project_complete",
      sql`(${t.projectEnc} IS NULL AND ${t.projectSeconds} IS NULL AND ${t.projectHackatimeIdEnc} IS NULL AND ${t.projectSavedAt} IS NULL)
        OR (${t.projectEnc} IS NOT NULL AND ${t.projectSeconds} >= ${sql.raw(String(CREDITED_SECONDS))} AND ${t.projectHackatimeIdEnc} IS NOT NULL AND ${t.projectSavedAt} IS NOT NULL)`,
    ),
    // A person is active on at most one team, as founder or partner.
    uniqueIndex("team_members_one_active_team")
      .on(t.userId)
      .where(sql`${t.releasedAt} IS NULL`),
    index("team_members_team_idx").on(t.teamId),
  ],
);

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    kind: applicationKind("kind").notNull(),
    feeMode: feeMode("fee_mode").notNull().default("founder_pays"),
    status: applicationStatus("status").notNull().default("submitted"),
    /** Form contents; shape depends on `kind` (see src/lib/applications/types.ts). */
    contentEnc: text("content_enc").notNull(),
    hackatimeSecondsSnapshot: integer("hackatime_seconds_snapshot"),
    /** Hackatime account id at submission (project applications), for review tools like Telescreen. */
    hackatimeIdEnc: text("hackatime_id_enc"),
    creditedSeconds: integer("credited_seconds"),
    noteEnc: text("note_enc"),
    /** Reviewer's internal justification (approved and cut: synced to Airtable; fraud: kept for the record). */
    justificationEnc: text("justification_enc"),
    /** Set once the review is pushed to the YSWS Airtable table. */
    airtableRecordId: text("airtable_record_id"),
    airtableSyncedAt: timestamp("airtable_synced_at", { withTimezone: true }),
    decidedByUserId: uuid("decided_by_user_id").references(() => users.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    /**
     * Round two (after the interview). The columns above stay the first-pass record, so the
     * justification Airtable received at the invite is never overwritten.
     */
    finalDecidedByUserId: uuid("final_decided_by_user_id").references(() => users.id),
    finalDecidedAt: timestamp("final_decided_at", { withTimezone: true }),
    finalNoteEnc: text("final_note_enc"),
    finalJustificationEnc: text("final_justification_enc"),
    supersededById: uuid("superseded_by_id").references((): AnyPgColumn => applications.id),
    teamId: uuid("team_id").references(() => teams.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One live application per user.
    uniqueIndex("applications_one_live_per_user")
      .on(t.userId)
      .where(sql`${t.supersededById} IS NULL`),
    index("applications_status_kind_idx").on(t.status, t.kind),
    check(
      "applications_rejection_needs_note",
      sql`${t.status} NOT IN ('rejected_cut', 'rejected_malformed') OR ${t.noteEnc} IS NOT NULL OR ${t.finalNoteEnc} IS NOT NULL`,
    ),
    check(
      "applications_decision_recorded",
      sql`(${t.status} = 'submitted') = (${t.decidedAt} IS NULL AND ${t.decidedByUserId} IS NULL)`,
    ),
    check(
      "applications_final_decision_recorded",
      sql`(${t.finalDecidedAt} IS NULL) = (${t.finalDecidedByUserId} IS NULL) AND (${t.finalDecidedAt} IS NULL OR ${t.status} IN ('approved', 'rejected_cut', 'rejected_fraud'))`,
    ),
    check(
      "applications_hours_match_kind",
      sql`(${t.kind} = 'project' AND ${t.creditedSeconds} >= ${sql.raw(String(CREDITED_SECONDS))} AND ${t.creditedSeconds} % ${sql.raw(String(CREDITED_SECONDS))} = 0 AND ${t.hackatimeSecondsSnapshot} >= ${t.creditedSeconds})
        OR (${t.kind} = 'aid' AND ${t.hackatimeSecondsSnapshot} IS NULL AND ${t.creditedSeconds} IS NULL)`,
    ),
    check(
      "applications_only_rejected_superseded",
      sql`${t.supersededById} IS NULL OR ${t.status} IN ('rejected_malformed', 'rejected_cut', 'rejected_fraud')`,
    ),
  ],
);

/** Who was on each application when it was submitted. Solo applications have one founder row. */
export const applicationMembers = pgTable(
  "application_members",
  {
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    role: teamRole("role").notNull(),
    /** A partner's frozen project on an "each pays" application. NULL for founders and founder-pays apps. */
    contentEnc: text("content_enc"),
    hackatimeSecondsSnapshot: integer("hackatime_seconds_snapshot"),
    creditedSeconds: integer("credited_seconds"),
    hackatimeIdEnc: text("hackatime_id_enc"),
    airtableRecordId: text("airtable_record_id"),
    airtableSyncedAt: timestamp("airtable_synced_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.applicationId, t.userId] }),
    check(
      "application_members_project_complete",
      sql`(${t.contentEnc} IS NULL AND ${t.hackatimeSecondsSnapshot} IS NULL AND ${t.creditedSeconds} IS NULL AND ${t.hackatimeIdEnc} IS NULL AND ${t.airtableRecordId} IS NULL)
        OR (${t.contentEnc} IS NOT NULL AND ${t.role} = 'partner' AND ${t.creditedSeconds} = ${sql.raw(String(CREDITED_SECONDS))} AND ${t.hackatimeSecondsSnapshot} >= ${t.creditedSeconds} AND ${t.hackatimeIdEnc} IS NOT NULL)`,
    ),
    index("application_members_user_idx").on(t.userId),
  ],
);

/** Users banned from the program after a fraud rejection. Never deleted. */
export const programBans = pgTable("program_bans", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id),
  applicationId: uuid("application_id").references(() => applications.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One row per Hack Club identity that has ever submitted an aid application. Never deleted. */
export const aidClaims = pgTable("aid_claims", {
  hcIdHash: text("hc_id_hash").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const funnelStep = pgEnum("funnel_step", [
  "visit",
  "signed_in",
  "hackatime_connected",
  "form_started",
  "submitted",
  "decided",
  /** The round-two decision after an interview. */
  "interviewed",
]);

export const funnelEvents = pgTable(
  "funnel_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    anonId: text("anon_id"),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    step: funnelStep("step").notNull(),
    /** Non-PII detail: { kind } for submitted, { decision } for decided. */
    meta: jsonb("meta").$type<Record<string, string>>(),
    /** Makes repeated recording idempotent, e.g. one visit per anon id per day. */
    dedupeKey: text("dedupe_key").unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("funnel_step_time_idx").on(t.step, t.createdAt),
    index("funnel_anon_idx").on(t.anonId),
  ],
);
