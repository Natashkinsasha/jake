CREATE TABLE IF NOT EXISTS "voice_prints" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "embedding" vector(256),
  "sample_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP DEFAULT now() NOT NULL,
  "updated_at" TIMESTAMP DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "voice_prints_user_idx" ON "voice_prints" ("user_id");
