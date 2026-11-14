ALTER TYPE "public"."application_status" ADD VALUE 'rejected_fraud';--> statement-breakpoint
CREATE TABLE "program_bans" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"application_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "justification_enc" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "airtable_record_id" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "airtable_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "program_bans" ADD CONSTRAINT "program_bans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_bans" ADD CONSTRAINT "program_bans_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;