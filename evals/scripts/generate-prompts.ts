import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFullSystemPrompt } from "../../apps/api/src/@logic/lesson/application/service/prompt-builder";
import { SUMMARY_PROMPT } from "../../apps/api/src/@logic/lesson/infrastructure/bull-handler/post-lesson.prompt";
import { FACT_EXTRACTION_PROMPT } from "../../apps/api/src/@logic/memory/application/service/fact-extraction.prompt";
import { firstLessonContext, returningStudentContext } from "../fixtures/lesson-contexts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const promptsDir = resolve(__dirname, "../prompts");

const greetingPrompt = buildFullSystemPrompt(returningStudentContext);
writeFileSync(resolve(promptsDir, "greeting-system.txt"), greetingPrompt);

const firstLessonPrompt = buildFullSystemPrompt(firstLessonContext);
writeFileSync(resolve(promptsDir, "greeting-first-lesson-system.txt"), firstLessonPrompt);

// The same prompts the API sends, so the evals can't drift from production
writeFileSync(resolve(promptsDir, "fact-extraction-system.txt"), FACT_EXTRACTION_PROMPT);
writeFileSync(resolve(promptsDir, "post-lesson-system.txt"), SUMMARY_PROMPT);

console.log("Generated eval prompts:");
console.log("  - prompts/greeting-system.txt");
console.log("  - prompts/greeting-first-lesson-system.txt");
console.log("  - prompts/fact-extraction-system.txt");
console.log("  - prompts/post-lesson-system.txt");
