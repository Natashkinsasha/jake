import { Injectable } from "@nestjs/common";

interface Exercise {
  id: string;
  correctAnswer: string | string[];
}

@Injectable()
export class HomeworkCheckerService {
  check(exercises: Exercise[], answers: Record<string, string>): number {
    let correct = 0;
    for (const exercise of exercises) {
      const answer = answers[exercise.id];
      if (!answer) continue;

      const correctAnswer = Array.isArray(exercise.correctAnswer)
        ? exercise.correctAnswer
        : [exercise.correctAnswer];

      if (correctAnswer.some((ca) => ca.toLowerCase().trim() === answer.toLowerCase().trim())) {
        correct++;
      }
    }
    return Math.round((correct / exercises.length) * 100);
  }
}
