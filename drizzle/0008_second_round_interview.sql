ALTER TYPE "public"."application_status" ADD VALUE 'interview' BEFORE 'approved';--> statement-breakpoint
ALTER TYPE "public"."funnel_step" ADD VALUE 'interviewed';--> statement-breakpoint
ALTER TABLE "applications" DROP CONSTRAINT "applications_rejection_needs_note";--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "final_decided_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "final_decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "final_note_enc" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "final_justification_enc" text;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_final_decided_by_user_id_users_id_fk" FOREIGN KEY ("final_decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_final_decision_recorded" CHECK (("applications"."final_decided_at" IS NULL) = ("applications"."final_decided_by_user_id" IS NULL) AND ("applications"."final_decided_at" IS NULL OR "applications"."status" IN ('approved', 'rejected_cut', 'rejected_fraud')));--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_rejection_needs_note" CHECK ("applications"."status" NOT IN ('rejected_cut', 'rejected_malformed') OR "applications"."note_enc" IS NOT NULL OR "applications"."final_note_enc" IS NOT NULL);