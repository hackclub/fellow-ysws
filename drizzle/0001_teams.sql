CREATE TYPE "public"."team_role" AS ENUM('founder', 'partner');--> statement-breakpoint
CREATE TABLE "application_members" (
	"application_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "team_role" NOT NULL,
	CONSTRAINT "application_members_application_id_user_id_pk" PRIMARY KEY("application_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "team_role" NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"released_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY NOT NULL,
	"founder_user_id" uuid NOT NULL,
	"invite_token_hash" text NOT NULL,
	"invite_token_enc" text NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"locked_at" timestamp with time zone,
	"dissolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_invite_token_hash_unique" UNIQUE("invite_token_hash")
);
--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "team_id" uuid;--> statement-breakpoint
ALTER TABLE "application_members" ADD CONSTRAINT "application_members_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_members" ADD CONSTRAINT "application_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_founder_user_id_users_id_fk" FOREIGN KEY ("founder_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_members_user_idx" ON "application_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_one_active_team" ON "team_members" USING btree ("user_id") WHERE "team_members"."released_at" IS NULL;--> statement-breakpoint
CREATE INDEX "team_members_team_idx" ON "team_members" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "teams_founder_idx" ON "teams" USING btree ("founder_user_id");--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Backfill: every existing application was submitted solo, so its founder is its only member.
INSERT INTO "application_members" ("application_id", "user_id", "role")
SELECT "id", "user_id", 'founder' FROM "applications"
ON CONFLICT DO NOTHING;
