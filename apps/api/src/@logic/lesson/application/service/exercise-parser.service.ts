import { Injectable, Logger } from "@nestjs/common";
import { ExerciseSchema, Exercise } from "@jake/shared";

@Injectable()
export class ExerciseParserService {
  private readonly logger = new Logger(ExerciseParserService.name);

  extract(text: string): Exercise | null {
    const match = text.match(/<exercise>([\s\S]*?)<\/exercise>/);
    if (!match?.[1]) return null;
    try {
      const parsed: unknown = JSON.parse(match[1]);
      const result = ExerciseSchema.safeParse(parsed);
      if (!result.success) {
        this.logger.warn(`Invalid exercise JSON from LLM: ${JSON.stringify(result.error.issues)}`);
        return null;
      }
      return result.data;
    } catch {
      return null;
    }
  }

  removeExerciseTags(text: string): string {
    return text.replace(/<exercise>[\s\S]*?<\/exercise>/g, "").trim();
  }
}
