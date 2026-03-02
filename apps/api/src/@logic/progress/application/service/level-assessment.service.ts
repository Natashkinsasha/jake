import { Injectable } from "@nestjs/common";

@Injectable()
export class LevelAssessmentService {
  assess(grammarProgress: Array<{ topic: string; level: number }>): string | null {
    if (grammarProgress.length === 0) return null;

    const avgLevel = grammarProgress.reduce((sum, g) => sum + g.level, 0) / grammarProgress.length;

    if (avgLevel >= 90) return "C2";
    if (avgLevel >= 75) return "C1";
    if (avgLevel >= 60) return "B2";
    if (avgLevel >= 45) return "B1";
    if (avgLevel >= 25) return "A2";
    return "A1";
  }
}
