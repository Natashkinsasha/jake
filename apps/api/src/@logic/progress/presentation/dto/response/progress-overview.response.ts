export interface ProgressOverviewResponse {
  currentLevel: string | null;
  grammarTopics: Array<{
    topic: string;
    level: number;
    errorCount: number;
  }>;
  totalLessons: number;
  totalWords: number;
}
