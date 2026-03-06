ALTER TABLE "tutors" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_tutors" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "tutors" CASCADE;--> statement-breakpoint
DROP TABLE "user_tutors" CASCADE;--> statement-breakpoint
ALTER TABLE "lessons" DROP CONSTRAINT "lessons_tutor_id_tutors_id_fk";
--> statement-breakpoint
ALTER TABLE "lessons" DROP COLUMN IF EXISTS "tutor_id";