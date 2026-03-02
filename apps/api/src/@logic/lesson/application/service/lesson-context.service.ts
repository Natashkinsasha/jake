import { Injectable } from "@nestjs/common";
import { UserDao } from "../../../auth/infrastructure/dao/user.dao";
import { LessonDao } from "../../infrastructure/dao/lesson.dao";
import { MemoryFactDao } from "../../../memory/infrastructure/dao/memory-fact.dao";
import { MemoryEmbeddingDao } from "../../../memory/infrastructure/dao/memory-embedding.dao";
import { GrammarProgressDao } from "../../../progress/infrastructure/dao/grammar-progress.dao";
import { VocabularyDao } from "../../../vocabulary/infrastructure/dao/vocabulary.dao";
import { UserTutorDao } from "../../../tutor/infrastructure/dao/user-tutor.dao";
import { LessonContext } from "../dto/lesson-context";

@Injectable()
export class LessonContextService {
  constructor(
    private userDao: UserDao,
    private lessonDao: LessonDao,
    private memoryFactDao: MemoryFactDao,
    private memoryEmbeddingDao: MemoryEmbeddingDao,
    private grammarProgressDao: GrammarProgressDao,
    private vocabularyDao: VocabularyDao,
    private userTutorDao: UserTutorDao,
  ) {}

  async build(userId: string): Promise<LessonContext> {
    const [
      user,
      facts,
      recentEmbeddings,
      grammarProgress,
      recentVocab,
      activeTutor,
      lessonCount,
    ] = await Promise.all([
      this.userDao.findByIdWithPreferences(userId),
      this.memoryFactDao.findActiveByUser(userId, 50),
      this.memoryEmbeddingDao.findRecentByUser(userId, 5),
      this.grammarProgressDao.findByUser(userId),
      this.vocabularyDao.findRecentByUser(userId, 20),
      this.userTutorDao.findActiveByUser(userId),
      this.lessonDao.countByUser(userId),
    ]);

    if (!user || !activeTutor) throw new Error("User or tutor not found");

    const prefs = user.user_preferences;

    return {
      studentName: user.users.name,
      level: user.users.currentLevel,
      lessonNumber: lessonCount + 1,
      tutorSystemPrompt: activeTutor.tutors.systemPrompt,
      tutorVoiceId: activeTutor.tutors.voiceId,
      tutorId: activeTutor.user_tutors.tutorId,
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
      recentEmotionalContext: recentEmbeddings.map(
        (e) => `- Lesson: ${e.emotionalTone} — ${e.content}`,
      ),
      learningFocus: {
        weakAreas: grammarProgress.filter((g) => g.level < 50).map((g) => g.topic),
        strongAreas: grammarProgress.filter((g) => g.level >= 70).map((g) => g.topic),
        recentWords: recentVocab.map((v) => v.word),
        suggestedTopic: grammarProgress.find((g) => g.level < 30)?.topic || null,
      },
    };
  }
}
