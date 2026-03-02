import { Injectable } from "@nestjs/common";

@Injectable()
export class ExerciseParserService {
  extract(text: string) {
    const match = text.match(/<exercise>([\s\S]*?)<\/exercise>/);
    if (!match) return null;
    try {
      return JSON.parse(match[1]);
    } catch {
      return null;
    }
  }

  removeExerciseTags(text: string): string {
    return text.replace(/<exercise>[\s\S]*?<\/exercise>/g, "").trim();
  }
}
