import type {
  BackendUser,
  UserPreferences,
  LessonListItem,
  LessonDetail,
  HomeworkListItem,
  VocabularyWord,
  ProgressData,
} from "@/types";
import { getBackendToken } from "@/lib/session";
import { API_URL } from "@/lib/config";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getBackendToken();

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`API Error: ${res.status}`);
  }

  return res.json();
}

export const api = {
  auth: {
    google: (data: { googleId: string; email: string; name: string; avatarUrl: string | null }) =>
      request<{ token: string; user: BackendUser }>("/auth/google", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    me: () => request<{ user_preferences?: UserPreferences } & BackendUser>("/auth/me"),
    updatePreferences: (data: Partial<UserPreferences>) =>
      request<{ success: boolean }>("/auth/me/preferences", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
  },
  tutors: {
    list: () =>
      request<{ id: string; name: string; personality: string; accent: string; avatarUrl: string | null; traits: string[] }[]>("/tutors"),
  },
  lessons: {
    list: () => request<LessonListItem[]>("/lessons"),
    get: (id: string) => request<LessonDetail>(`/lessons/${id}`),
    end: (id: string, history: { role: string; content: string }[]) =>
      request<{ success: boolean }>(`/lessons/end/${id}`, {
        method: "POST",
        body: JSON.stringify({ history }),
      }),
  },
  homework: {
    list: () => request<HomeworkListItem[]>("/homework"),
    get: (id: string) => request<HomeworkListItem>(`/homework/${id}`),
    submit: (id: string, answers: Record<string, string>) =>
      request<{ score: number }>(`/homework/${id}/submit`, {
        method: "POST",
        body: JSON.stringify({ answers }),
      }),
  },
  vocabulary: {
    list: (userId: string) =>
      request<{ words: VocabularyWord[] }>(`/vocabulary?userId=${userId}`),
    review: (userId: string) =>
      request<{ words: VocabularyWord[] }>(`/vocabulary/review?userId=${userId}`),
  },
  progress: {
    get: (userId: string) => request<ProgressData>(`/progress?userId=${userId}`),
  },
};
