import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFullSystemPrompt } from "../../apps/api/src/@logic/lesson/application/service/prompt-builder";
import { firstLessonContext, returningStudentContext } from "../fixtures/lesson-contexts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const promptsDir = resolve(__dirname, "../prompts");

const greetingPrompt = buildFullSystemPrompt(returningStudentContext);
writeFileSync(resolve(promptsDir, "greeting-system.txt"), greetingPrompt);

const firstLessonPrompt = buildFullSystemPrompt(firstLessonContext);
writeFileSync(resolve(promptsDir, "greeting-first-lesson-system.txt"), firstLessonPrompt);

console.log("Generated eval prompts:");
console.log("  - prompts/greeting-system.txt");
console.log("  - prompts/greeting-first-lesson-system.txt");
