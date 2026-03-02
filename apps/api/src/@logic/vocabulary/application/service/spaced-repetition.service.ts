import { Injectable } from "@nestjs/common";

@Injectable()
export class SpacedRepetitionService {
  calculateNextReview(currentStrength: number, correct: boolean): { strength: number; nextReview: Date } {
    const newStrength = correct
      ? Math.min(100, currentStrength + 10)
      : Math.max(0, currentStrength - 20);

    const intervals = [1, 3, 7, 14, 30, 60];
    const intervalIndex = Math.min(Math.floor(newStrength / 20), intervals.length - 1);
    const days = intervals[intervalIndex];

    return {
      strength: newStrength,
      nextReview: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    };
  }
}
