import { API_URL } from "@/lib/config";
import { getBackendToken } from "@/lib/session";
import type {
  BackendUser,
  LessonDetail,
  LessonListItem,
  UserPreferences,
  VocabularyItem,
  VocabularyStats,
} from "@/types";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getBackendToken();

  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  if (options?.body != null) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { message?: string; error?: string };
      detail = body.message ?? body.error ?? "";
    } catch {}
    throw new Error(`API Error ${String(res.status)} ${path}${detail ? `: ${detail}` : ""}`);
  }

  return (await res.json()) as T;
}

export const api = {
  auth: {
    google: (data: { googleId: string; email: string; name: string; avatarUrl: string | null }) =>
      request<{ token: string; user: BackendUser }>("/auth/google", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    me: () => request<{ users: BackendUser; user_preferences: UserPreferences | null }>("/auth/me"),
    updatePreferences: (data: Partial<UserPreferences>) =>
      request<{ success: boolean }>("/auth/me/preferences", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    resetAccount: () =>
      request<{ success: boolean }>("/auth/me/reset", {
        method: "POST",
      }),
  },
  tutor: {
    profiles: () =>
      request<{ gender: string; nationality: string; description: string; traits: string[] }[]>("/tutor/profiles"),
    voices: (gender: string) =>
      request<{ id: string; name: string; gender: string; previewUrl: string }[]>(`/tutor/voices?gender=${gender}`),
  },
  lessons: {
    list: (offset = 0, limit = 10) => request<LessonListItem[]>(`/lessons?offset=${offset}&limit=${limit}`),
    get: (id: string) => request<LessonDetail>(`/lessons/${id}`),
    end: (id: string, history: { role: string; content: string }[]) =>
      request<{ success: boolean }>(`/lessons/end/${id}`, {
        method: "POST",
        body: JSON.stringify({ history }),
      }),
  },
  stt: {
    token: () => request<{ key: string }>("/lessons/stt/token"),
    metrics: (data: { durationMs: number; transcriptLength: number; segments: number }) =>
      request<{ success: boolean }>("/lessons/stt/metrics", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
  tts: {
    token: () => request<{ token: string }>("/lessons/tts/token"),
  },
  vocabulary: {
    list: (params?: { status?: string; topic?: string; lessonId?: string; offset?: number; limit?: number }) => {
      const query = new URLSearchParams();
      if (params?.status) query.set("status", params.status);
      if (params?.topic) query.set("topic", params.topic);
      if (params?.lessonId) query.set("lessonId", params.lessonId);
      if (params?.offset != null) query.set("offset", String(params.offset));
      if (params?.limit != null) query.set("limit", String(params.limit));
      const qs = query.toString();
      return request<VocabularyItem[]>(`/vocabulary${qs ? `?${qs}` : ""}`);
    },
    stats: () => request<VocabularyStats>("/vocabulary/stats"),
    topics: () => request<string[]>("/vocabulary/topics"),
    add: (data: { word: string; translation: string; topic: string; lessonId?: string }) =>
      request<{ success: boolean; id: string }>("/vocabulary", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    delete: (id: string) => request<{ success: boolean }>(`/vocabulary/${id}`, { method: "DELETE" }),
  },
};
