CREATE TYPE "public"."fee_mode" AS ENUM('founder_pays', 'each_pays');--> statement-breakpoint
ALTER TABLE "application_members" ADD COLUMN "content_enc" text;--> statement-breakpoint
ALTER TABLE "application_members" ADD COLUMN "hackatime_seconds_snapshot" integer;--> statement-breakpoint
ALTER TABLE "application_members" ADD COLUMN "credited_seconds" integer;--> statement-breakpoint
ALTER TABLE "application_members" ADD COLUMN "hackatime_id_enc" text;--> statement-breakpoint
ALTER TABLE "application_members" ADD COLUMN "airtable_record_id" text;--> statement-breakpoint
ALTER TABLE "application_members" ADD COLUMN "airtable_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "fee_mode" "fee_mode" DEFAULT 'founder_pays' NOT NULL;--> statement-breakpoint
ALTER TABLE "team_members" ADD COLUMN "project_enc" text;--> statement-breakpoint
ALTER TABLE "team_members" ADD COLUMN "project_seconds" integer;--> statement-breakpoint
ALTER TABLE "team_members" ADD COLUMN "project_hackatime_id_enc" text;--> statement-breakpoint
ALTER TABLE "team_members" ADD COLUMN "project_saved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "fee_mode" "fee_mode" DEFAULT 'founder_pays' NOT NULL;--> statement-breakpoint
ALTER TABLE "application_members" ADD CONSTRAINT "application_members_project_complete" CHECK (("application_members"."content_enc" IS NULL AND "application_members"."hackatime_seconds_snapshot" IS NULL AND "application_members"."credited_seconds" IS NULL AND "application_members"."hackatime_id_enc" IS NULL AND "application_members"."airtable_record_id" IS NULL)
        OR ("application_members"."content_enc" IS NOT NULL AND "application_members"."role" = 'partner' AND "application_members"."credited_seconds" = 7200 AND "application_members"."hackatime_seconds_snapshot" >= "application_members"."credited_seconds" AND "application_members"."hackatime_id_enc" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_project_complete" CHECK (("team_members"."project_enc" IS NULL AND "team_members"."project_seconds" IS NULL AND "team_members"."project_hackatime_id_enc" IS NULL AND "team_members"."project_saved_at" IS NULL)
        OR ("team_members"."project_enc" IS NOT NULL AND "team_members"."project_seconds" >= 7200 AND "team_members"."project_hackatime_id_enc" IS NOT NULL AND "team_members"."project_saved_at" IS NOT NULL));