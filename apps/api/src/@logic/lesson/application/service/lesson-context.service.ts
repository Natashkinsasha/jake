import { Injectable, NotFoundException } from "@nestjs/common";
import { UserDao } from "../../../auth/infrastructure/dao/user.dao";
import { LessonDao } from "../../infrastructure/dao/lesson.dao";
import { MemoryRetrievalService } from "../../../memory/application/service/memory-retrieval.service";
import { GrammarProgressDao } from "../../../progress/infrastructure/dao/grammar-progress.dao";
import { VocabularyDao } from "../../../vocabulary/infrastructure/dao/vocabulary.dao";
import { UserTutorRepository } from "../../../tutor/infrastructure/repository/user-tutor.repository";
import { LessonContext } from "../dto/lesson-context";

@Injectable()
export class LessonContextService {
  constructor(
    private userDao: UserDao,
    private lessonDao: LessonDao,
    private memoryRetrievalService: MemoryRetrievalService,
    private grammarProgressDao: GrammarProgressDao,
    private vocabularyDao: VocabularyDao,
    private userTutorRepository: UserTutorRepository,
  ) {}

  async build(userId: string): Promise<LessonContext> {
    const [
      user,
      grammarProgress,
      recentVocab,
      activeTutor,
      lessonCount,
    ] = await Promise.all([
      this.userDao.findByIdWithPreferences(userId),
      this.grammarProgressDao.findByUser(userId),
      this.vocabularyDao.findRecentByUser(userId, 20),
      this.userTutorRepository.findActiveByUser(userId),
      this.lessonDao.countByUser(userId),
    ]);

    if (!user || !activeTutor) throw new NotFoundException("User or tutor not found");

    const suggestedTopic = grammarProgress.find((g) => g.level < 30)?.topic || null;

    const { facts, relevantMemories } = await this.memoryRetrievalService.retrieve(
      userId,
      suggestedTopic || "general English lesson",
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
        suggestedTopic,
      },
    };
  }
}
