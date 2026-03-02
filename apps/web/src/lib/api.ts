const API_URL = process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" ? "/api" : "http://localhost:4000");

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("session_token") : null;

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
      request<{ token: string; user: { id: string; email: string; name: string; avatarUrl: string | null; currentLevel: string | null } }>("/auth/google", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    me: () => request<any>("/auth/me"),
    updatePreferences: (data: any) =>
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
    list: () => request<any[]>("/lessons"),
    get: (id: string) =>
      request<{
        id: string;
        status: string;
        topic: string | null;
        createdAt: string;
        duration: number | null;
        summary: string | null;
        lessonNumber: number;
        messages: { role: string; content: string; timestamp: string }[];
      }>(`/lessons/${id}`),
    end: (id: string, history: { role: string; content: string }[]) =>
      request<{ success: boolean }>(`/lessons/end/${id}`, {
        method: "POST",
        body: JSON.stringify({ history }),
      }),
  },
  homework: {
    list: () => request<any[]>("/homework"),
    get: (id: string) =>
      request<{ id: string; lessonId: string; exercises: any[]; createdAt: string; dueAt: string | null; completedAt: string | null; score: number | null }>(`/homework/${id}`),
    submit: (id: string, answers: Record<string, string>) =>
      request<any>(`/homework/${id}/submit`, {
        method: "POST",
        body: JSON.stringify({ answers }),
      }),
  },
  vocabulary: {
    list: (userId: string) =>
      request<{ words: { id: string; word: string; strength: number; nextReview: string | null }[] }>(`/vocabulary?userId=${userId}`),
    review: (userId: string) =>
      request<{ words: { id: string; word: string; strength: number; nextReview: string | null }[] }>(`/vocabulary/review?userId=${userId}`),
  },
  progress: {
    get: (userId: string) =>
      request<{ currentLevel: string | null; grammarTopics: { topic: string; level: number; errorCount: number }[]; totalLessons: number; totalWords: number }>(`/progress?userId=${userId}`),
  },
};
