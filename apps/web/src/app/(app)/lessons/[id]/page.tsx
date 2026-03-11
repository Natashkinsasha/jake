"use client";

import { useParams, useRouter } from "next/navigation";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useApiQuery } from "@/hooks/useApiQuery";
import { api } from "@/lib/api";
import { formatLessonDate } from "@/lib/utils";

export default function LessonHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: lesson, isLoading, error, refetch } = useApiQuery(() => api.lessons.get(id), [id]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl py-8 text-center text-gray-400">
        <LoadingSpinner className="h-32" />
      </div>
    );
  }

  if (error) return <ErrorMessage message={error} onRetry={refetch} />;
  if (!lesson) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Header */}
      <div>
        <button
          type="button"
          onClick={() => {
            router.push("/dashboard");
          }}
          className="mb-2 inline-block text-sm text-gray-400 hover:text-gray-600"
        >
          &larr; Back to dashboard
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          Lesson {lesson.lessonNumber}
          {lesson.topic ? `: ${lesson.topic}` : ""}
        </h1>
        <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
          {lesson.createdAt && <span>{formatLessonDate(lesson.createdAt)}</span>}
          {lesson.duration != null && lesson.duration > 0 && <span>{Math.max(1, lesson.duration)} min</span>}
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              lesson.status === "completed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
            }`}
          >
            {lesson.status}
          </span>
        </div>
      </div>

      {/* Summary */}
      {lesson.summary && (
        <div className="card border border-blue-100 bg-blue-50">
          <p className="text-sm text-gray-700">{lesson.summary}</p>
        </div>
      )}

      {/* Messages */}
      <div className="card">
        <h3 className="mb-4 font-semibold text-gray-900">Conversation</h3>
        {lesson.messages.length === 0 ? (
          <p className="text-sm text-gray-400">No messages yet. Summary will appear after the lesson is processed.</p>
        ) : (
          <div className="space-y-3">
            {lesson.messages.map((msg) => (
              <div key={msg.timestamp} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                    msg.role === "user"
                      ? "rounded-br-md bg-primary-500 text-white"
                      : "rounded-bl-md bg-gray-100 text-gray-800"
                  }`}
                >
                  <p>{msg.content}</p>
                  <p className={`mt-1 text-[10px] ${msg.role === "user" ? "text-blue-100" : "text-gray-400"}`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
