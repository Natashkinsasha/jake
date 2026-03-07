ALTER TABLE "lessons" DROP CONSTRAINT IF EXISTS "lessons_tutor_id_tutors_id_fk";
--> statement-breakpoint
ALTER TABLE "lessons" DROP COLUMN IF EXISTS "tutor_id";--> statement-breakpoint
DROP TABLE IF EXISTS "user_tutors" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "tutors" CASCADE;