export interface HomeworkDetailResponse {
  id: string;
  lessonId: string;
  exercises: any[];
  createdAt: string;
  dueAt: string | null;
  completedAt: string | null;
  score: number | null;
}
