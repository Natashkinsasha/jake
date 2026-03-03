import { Injectable, NotFoundException } from "@nestjs/common";
import { AuthContract } from "../../../auth/contract/auth.contract";
import { LessonRepository } from "../../infrastructure/repository/lesson.repository";
import { MemoryContract } from "../../../memory/contract/memory.contract";
import { TutorContract } from "../../../tutor/contract/tutor.contract";
import { LessonContext } from "../dto/lesson-context";

@Injectable()
export class LessonContextService {
  constructor(
    private authContract: AuthContract,
    private lessonRepository: LessonRepository,
    private memoryContract: MemoryContract,
    private tutorContract: TutorContract,
  ) {}

  async build(userId: string): Promise<LessonContext> {
    const [
      user,
      activeTutor,
      lessonCount,
    ] = await Promise.all([
      this.authContract.findByIdWithPreferences(userId),
      this.tutorContract.findActiveUserTutor(userId),
      this.lessonRepository.countByUser(userId),
    ]);

    if (!user || !activeTutor) throw new NotFoundException("User or tutor not found");

    const { facts, relevantMemories } = await this.memoryContract.retrieve(
      userId,
      "general English lesson",
    );

    const prefs = user.user_preferences;

    return {
      studentName: user.users.name,
      level: user.users.currentLevel,
      lessonNumber: lessonCount + 1,
      tutorSystemPrompt: activeTutor.tutor.systemPrompt,
      tutorVoiceId: activeTutor.tutor.voiceId,
      tutorId: activeTutor.userTutor.tutorId,
      preferences: {
        correctionStyle: prefs?.correctionStyle ?? "immediate",
        speakingSpeed: prefs?.speakingSpeed ?? "natural",
        useNativeLanguage: prefs?.useNativeLanguage ?? false,
        explainGrammar: prefs?.explainGrammar ?? true,
        preferredExercises: prefs?.preferredExerciseTypes ?? [],
        interests: prefs?.interests ?? [],
      },
      facts: facts.map((f) => ({
        category: f.category,
        fact: f.fact,
      })),
      recentEmotionalContext: relevantMemories.map(
         (e) => `- Lesson (relevance: ${(e.similarity * 100).toFixed(0)}%): ${e.emotional_tone} — ${e.content}`,
      ),
    };
  }
}
