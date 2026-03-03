import { Injectable, NotFoundException } from "@nestjs/common";
import { AuthContract } from "../../../auth/contract/auth.contract";
import { LessonRepository } from "../../infrastructure/repository/lesson.repository";
import { MemoryContract } from "../../../memory/contract/memory.contract";
import { ProgressContract } from "../../../progress/contract/progress.contract";
import { VocabularyContract } from "../../../vocabulary/contract/vocabulary.contract";
import { TutorContract } from "../../../tutor/contract/tutor.contract";
import { LessonContext } from "../dto/lesson-context";

@Injectable()
export class LessonContextService {
  constructor(
    private authContract: AuthContract,
    private lessonRepository: LessonRepository,
    private memoryContract: MemoryContract,
    private progressContract: ProgressContract,
    private vocabularyContract: VocabularyContract,
    private tutorContract: TutorContract,
  ) {}

  async build(userId: string): Promise<LessonContext> {
    const [
      user,
      grammarProgress,
      recentVocab,
      activeTutor,
      lessonCount,
    ] = await Promise.all([
      this.authContract.findByIdWithPreferences(userId),
      this.progressContract.findByUser(userId),
      this.vocabularyContract.findRecentByUser(userId, 20),
      this.tutorContract.findActiveUserTutor(userId),
      this.lessonRepository.countByUser(userId),
    ]);

    if (!user || !activeTutor) throw new NotFoundException("User or tutor not found");

    const suggestedTopics: string[] = [];
    const weak = grammarProgress
      .filter((g) => g.level < 30)
      .sort((a, b) => a.level - b.level);
    const medium = grammarProgress
      .filter((g) => g.level >= 30 && g.level < 50)
      .sort((a, b) => a.level - b.level);

    for (const g of weak) {
      if (suggestedTopics.length >= 3) break;
      suggestedTopics.push(g.topic);
    }
    for (const g of medium) {
      if (suggestedTopics.length >= 3) break;
      suggestedTopics.push(g.topic);
    }

    const { facts, relevantMemories } = await this.memoryContract.retrieve(
      userId,
      suggestedTopics[0] || "general English lesson",
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
        correctionStyle: prefs?.correctionStyle || "immediate",
        speakingSpeed: prefs?.speakingSpeed || "natural",
        useNativeLanguage: prefs?.useNativeLanguage || false,
        explainGrammar: prefs?.explainGrammar ?? true,
        preferredExercises: prefs?.preferredExerciseTypes || [],
        interests: prefs?.interests || [],
      },
      facts: facts.map((f) => ({
        category: f.category,
        fact: f.fact,
      })),
      recentEmotionalContext: relevantMemories.map(
        (e: any) => `- Lesson (relevance: ${(e.similarity * 100).toFixed(0)}%): ${e.emotional_tone} — ${e.content}`,
      ),
      learningFocus: {
        weakAreas: grammarProgress.filter((g) => g.level < 50).map((g) => g.topic),
        strongAreas: grammarProgress.filter((g) => g.level >= 70).map((g) => g.topic),
        recentWords: recentVocab.map((v) => v.word),
        suggestedTopics,
      },
    };
  }
}
