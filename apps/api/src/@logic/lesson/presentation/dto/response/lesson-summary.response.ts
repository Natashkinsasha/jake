export interface LessonSummaryResponse {
  id: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
  summary: string | null;
  topics: string[];
  newWords: string[];
}
