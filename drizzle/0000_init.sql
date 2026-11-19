CREATE TYPE "public"."response_status" AS ENUM('in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."survey_status" AS ENUM('draft', 'published', 'closed');--> statement-breakpoint
CREATE TABLE "admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"window_start" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"survey_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"status" "response_status" NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"resume_token_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "survey_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"survey_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"definition" jsonb NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "survey_versions_survey_id_id_uq" UNIQUE("survey_id","id")
);
--> statement-breakpoint
CREATE TABLE "surveys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"status" "survey_status" DEFAULT 'draft' NOT NULL,
	"draft" jsonb NOT NULL,
	"latest_version" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_survey_version_fk" FOREIGN KEY ("survey_id","version_id") REFERENCES "public"."survey_versions"("survey_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_versions" ADD CONSTRAINT "survey_versions_survey_id_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."surveys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_owner_id_admins_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "responses_version_status_idx" ON "responses" USING btree ("version_id","status");--> statement-breakpoint
CREATE INDEX "responses_survey_status_idx" ON "responses" USING btree ("survey_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "survey_versions_survey_version_uq" ON "survey_versions" USING btree ("survey_id","version");--> statement-breakpoint
CREATE INDEX "surveys_owner_updated_idx" ON "surveys" USING btree ("owner_id","updated_at");