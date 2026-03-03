CREATE TABLE IF NOT EXISTS "user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"correction_style" varchar(50) DEFAULT 'immediate',
	"explain_grammar" boolean DEFAULT true,
	"speaking_speed" varchar(20) DEFAULT 'natural',
	"use_native_language" boolean DEFAULT false,
	"preferred_exercise_types" jsonb DEFAULT '[]'::jsonb,
	"interests" jsonb DEFAULT '[]'::jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"google_id" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"avatar_url" text,
	"native_language" varchar(10) DEFAULT 'ru',
	"current_level" varchar(5),
	"onboarding_completed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "homework" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"exercises" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"due_at" timestamp,
	"completed_at" timestamp,
	"score" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lesson_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"role" varchar(10) NOT NULL,
	"content" text NOT NULL,
	"audio_url" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tutor_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"duration_minutes" integer,
	"summary" text,
	"topics" jsonb DEFAULT '[]'::jsonb,
	"new_words" jsonb DEFAULT '[]'::jsonb,
	"errors_found" jsonb DEFAULT '[]'::jsonb,
	"level_assessment" varchar(5),
	"lesson_number" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "memory_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lesson_id" uuid,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"emotional_tone" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "memory_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" varchar(50) NOT NULL,
	"fact" text NOT NULL,
	"source" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "grammar_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"topic" varchar(255) NOT NULL,
	"level" integer DEFAULT 50 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tutors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"personality" text NOT NULL,
	"system_prompt" text NOT NULL,
	"voice_id" varchar(255) NOT NULL,
	"accent" varchar(50) NOT NULL,
	"avatar_url" text,
	"traits" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_tutors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tutor_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true,
	"selected_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vocabulary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"word" varchar(255) NOT NULL,
	"lesson_id" uuid,
	"strength" integer DEFAULT 0 NOT NULL,
	"next_review" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "homework" ADD CONSTRAINT "homework_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "homework" ADD CONSTRAINT "homework_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lesson_messages" ADD CONSTRAINT "lesson_messages_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lessons" ADD CONSTRAINT "lessons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lessons" ADD CONSTRAINT "lessons_tutor_id_tutors_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memory_embeddings" ADD CONSTRAINT "memory_embeddings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memory_embeddings" ADD CONSTRAINT "memory_embeddings_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memory_facts" ADD CONSTRAINT "memory_facts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "grammar_progress" ADD CONSTRAINT "grammar_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_tutors" ADD CONSTRAINT "user_tutors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_tutors" ADD CONSTRAINT "user_tutors_tutor_id_tutors_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vocabulary" ADD CONSTRAINT "vocabulary_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vocabulary" ADD CONSTRAINT "vocabulary_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "homework_user_idx" ON "homework" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "homework_lesson_idx" ON "homework" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lesson_messages_lesson_idx" ON "lesson_messages" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lessons_user_idx" ON "lessons" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lessons_status_idx" ON "lessons" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memory_embeddings_user_idx" ON "memory_embeddings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memory_facts_user_idx" ON "memory_facts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memory_facts_category_idx" ON "memory_facts" USING btree ("user_id","category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "grammar_progress_user_idx" ON "grammar_progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "grammar_progress_topic_idx" ON "grammar_progress" USING btree ("user_id","topic");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_tutors_user_idx" ON "user_tutors" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vocabulary_user_idx" ON "vocabulary" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vocabulary_review_idx" ON "vocabulary" USING btree ("user_id","next_review");