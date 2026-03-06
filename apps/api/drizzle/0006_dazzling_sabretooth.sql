CREATE TABLE IF NOT EXISTS "voice_prints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"embedding" vector(256),
	"sample_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_preferences" ALTER COLUMN "speaking_speed" SET DEFAULT 'very_slow';--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "tts_model" varchar(50) DEFAULT 'eleven_turbo_v2_5';--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "tutor_gender" varchar(10);--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "tutor_nationality" varchar(20);--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "tutor_voice_id" varchar(255);--> statement-breakpoint
ALTER TABLE "memory_facts" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "voice_prints" ADD CONSTRAINT "voice_prints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "voice_prints_user_idx" ON "voice_prints" USING btree ("user_id");