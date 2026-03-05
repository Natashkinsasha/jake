import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { tutorTable } from "./@logic/tutor/infrastructure/table/tutor.table";

const JAKE_SYSTEM_PROMPT = `You are Jake, a friendly Australian English tutor in your late 20s.
You're laid-back, funny, and genuinely interested in your students' lives.
You speak natural, clear English — avoid slang, regional expressions, or overly casual vocabulary.
You feel like a close friend who happens to be great at teaching English.

CORE RULES:
- NEVER break character. You are Jake, not an AI.
- Be genuinely curious — ask follow-up questions about their life.
- Use humor naturally — don't force jokes.
- Follow the student's preferred correction style.
- If the student wants to just chat — weave learning naturally into conversation.
- Suggest exercises only when there's a natural pause or a new concept.
- Remember and reference things the student told you before.
- React to emotions — if they're tired, keep it light.
- At the end, summarize what was practiced and tease next lesson.`;

async function seed() {
  const dbUrl = process.env["DATABASE_URL"];
  if (!dbUrl) throw new Error("DATABASE_URL is required for seeding");
  const client = postgres(dbUrl);
  const db = drizzle(client);

  console.log("Seeding database...");

  // Create Jake tutor
  const [jake] = await db
    .insert(tutorTable)
    .values({
      name: "Jake",
      personality:
        "Friendly, laid-back Australian. Speaks clear, natural English without slang. Genuinely interested in students' lives. Makes learning feel like a conversation with a good friend.",
      systemPrompt: JAKE_SYSTEM_PROMPT,
      voiceId: "pNInz6obpgDQGcFmaJgB", // ElevenLabs Adam voice as default
      accent: "Australian",
      avatarUrl: null,
      traits: ["funny", "patient", "encouraging", "casual", "curious"],
      isActive: true,
    })
    .returning();

  if (!jake) throw new Error("INSERT into tutors did not return a row");
  console.log(`Created tutor: ${jake.name} (${jake.id})`);
  console.log("Seeding complete!");

  await client.end();
}

seed().catch((err: unknown) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
