import { Injectable, NotFoundException } from "@nestjs/common";
import { AuthContract } from "../../../auth/contract/auth.contract";
import { LessonRepository } from "../../infrastructure/repository/lesson.repository";
import { MemoryContract } from "../../../memory/contract/memory.contract";
import { ProgressContract } from "../../../progress/contract/progress.contract";
import { VocabularyContract } from "../../../vocabulary/contract/vocabulary.contract";
import { getTutorProfile } from "../../../tutor/domain/tutor-profiles";
import { getDefaultVoice, getVoicesByGender } from "../../../tutor/domain/tutor-voices";
import type { TutorGender, TutorNationality } from "../../../tutor/domain/tutor-types";
import { LessonContext } from "../dto/lesson-context";

@Injectable()
export class LessonContextService {
  constructor(
    private authContract: AuthContract,
    private lessonRepository: LessonRepository,
    private memoryContract: MemoryContract,
    private progressContract: ProgressContract,
    private vocabularyContract: VocabularyContract,
  ) {}

  async build(userId: string): Promise<LessonContext> {
    const [
      user,
      grammarProgress,
      recentVocab,
      lessonCount,
      recentLessons,
    ] = await Promise.all([
      this.authContract.findByIdWithPreferences(userId),
      this.progressContract.findByUser(userId),
      this.vocabularyContract.findRecentByUser(userId, 20),
      this.lessonRepository.countByUser(userId),
      this.lessonRepository.findRecentByUser(userId, 1),
    ]);

    if (!user) throw new NotFoundException("User not found");

    const prefs = user.user_preferences;

    const gender = (prefs?.tutorGender ?? "male") as TutorGender;
    const nationality = (prefs?.tutorNationality ?? "australian") as TutorNationality;
    const storedVoiceId = prefs?.tutorVoiceId;
    const validVoiceIds = getVoicesByGender(gender).map((v) => v.id);
    const voiceId = storedVoiceId && validVoiceIds.includes(storedVoiceId)
      ? storedVoiceId
      : getDefaultVoice(gender).id;
    const profile = getTutorProfile(nationality, gender);

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
      suggestedTopics[0] ?? "general English lesson",
    );

    return {
      studentName: user.users.name,
      level: user.users.currentLevel,
      onboardingCompleted: user.users.onboardingCompleted ?? false,
      lessonNumber: lessonCount + 1,
      lastLessonAt: recentLessons[0]?.startedAt ?? null,
      tutorPromptFragment: profile.promptFragment,
      tutorVoiceId: voiceId,
      preferences: {
        correctionStyle: prefs?.correctionStyle ?? "immediate",
        speakingSpeed: prefs?.speakingSpeed ?? "very_slow",
        useNativeLanguage: prefs?.useNativeLanguage ?? false,
        explainGrammar: prefs?.explainGrammar ?? true,
        preferredExercises: prefs?.preferredExerciseTypes ?? [],
        interests: prefs?.interests ?? [],
        ttsModel: prefs?.ttsModel ?? "eleven_turbo_v2_5",
      },
      facts: facts.map((f) => ({
        category: f.category,
        fact: f.fact,
      })),
      recentEmotionalContext: relevantMemories.map(
         (e) => `- Lesson (relevance: ${(e.similarity * 100).toFixed(0)}%): ${e.emotional_tone} — ${e.content}`,
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
