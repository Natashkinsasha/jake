import type {
  BackendUser,
  UserPreferences,
  LessonListItem,
  LessonDetail,
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
    let detail = "";
    try {
      const body = (await res.json()) as { message?: string; error?: string };
      detail = body.message ?? body.error ?? "";
    } catch {}
    throw new Error(
      `API Error ${res.status} ${path}${detail ? `: ${detail}` : ""}`,
    );
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
};
