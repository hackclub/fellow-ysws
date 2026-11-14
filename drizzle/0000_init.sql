CREATE TYPE "public"."application_kind" AS ENUM('project', 'aid');--> statement-breakpoint
CREATE TYPE "public"."application_status" AS ENUM('submitted', 'approved', 'rejected_cut', 'rejected_malformed');--> statement-breakpoint
CREATE TYPE "public"."funnel_step" AS ENUM('visit', 'signed_in', 'hackatime_connected', 'form_started', 'submitted', 'decided');--> statement-breakpoint
CREATE TABLE "aid_claims" (
	"hc_id_hash" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "application_kind" NOT NULL,
	"status" "application_status" DEFAULT 'submitted' NOT NULL,
	"content_enc" text NOT NULL,
	"hackatime_seconds_snapshot" integer,
	"credited_seconds" integer,
	"note_enc" text,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"superseded_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "applications_rejection_needs_note" CHECK ("applications"."status" NOT IN ('rejected_cut', 'rejected_malformed') OR "applications"."note_enc" IS NOT NULL),
	CONSTRAINT "applications_decision_recorded" CHECK (("applications"."status" = 'submitted') = ("applications"."decided_at" IS NULL AND "applications"."decided_by_user_id" IS NULL)),
	CONSTRAINT "applications_hours_match_kind" CHECK (("applications"."kind" = 'project' AND "applications"."hackatime_seconds_snapshot" >= 7200 AND "applications"."credited_seconds" = 7200)
        OR ("applications"."kind" = 'aid' AND "applications"."hackatime_seconds_snapshot" IS NULL AND "applications"."credited_seconds" IS NULL)),
	CONSTRAINT "applications_only_malformed_superseded" CHECK ("applications"."superseded_by_id" IS NULL OR "applications"."status" = 'rejected_malformed')
);
--> statement-breakpoint
CREATE TABLE "funnel_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"anon_id" text,
	"user_id" uuid,
	"step" "funnel_step" NOT NULL,
	"meta" jsonb,
	"dedupe_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "funnel_events_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"hc_id_hash" text NOT NULL,
	"pii_enc" text NOT NULL,
	"hackatime_connected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_hc_id_hash_unique" UNIQUE("hc_id_hash")
);
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_superseded_by_id_applications_id_fk" FOREIGN KEY ("superseded_by_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_events" ADD CONSTRAINT "funnel_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "applications_one_live_per_user" ON "applications" USING btree ("user_id") WHERE "applications"."superseded_by_id" IS NULL;--> statement-breakpoint
CREATE INDEX "applications_status_kind_idx" ON "applications" USING btree ("status","kind");--> statement-breakpoint
CREATE INDEX "funnel_step_time_idx" ON "funnel_events" USING btree ("step","created_at");--> statement-breakpoint
CREATE INDEX "funnel_anon_idx" ON "funnel_events" USING btree ("anon_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");