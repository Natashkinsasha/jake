DROP INDEX IF EXISTS "vocabulary_review_idx";--> statement-breakpoint
ALTER TABLE "vocabulary" ADD COLUMN "translation" varchar(255);--> statement-breakpoint
ALTER TABLE "vocabulary" ADD COLUMN "topic" varchar(100);--> statement-breakpoint
ALTER TABLE "vocabulary" ADD COLUMN "status" varchar(20) DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE "vocabulary" ADD COLUMN "review_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "vocabulary" ADD COLUMN "last_reviewed_at" timestamp;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vocabulary_status_idx" ON "vocabulary" USING btree ("user_id","status");--> statement-breakpoint
ALTER TABLE "vocabulary" DROP COLUMN IF EXISTS "strength";--> statement-breakpoint
ALTER TABLE "vocabulary" DROP COLUMN IF EXISTS "next_review";