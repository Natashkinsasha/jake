"use client";

import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatLessonDate } from "@/lib/utils";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { useApiQuery } from "@/hooks/useApiQuery";

export default function LessonHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: lesson, isLoading, error, refetch } = useApiQuery(
    () => api.lessons.get(id),
    [id],
  );

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto py-8 text-center text-gray-400">
        <LoadingSpinner className="h-32" />
      </div>
    );
  }

  if (error) return <ErrorMessage message={error} onRetry={refetch} />;
  if (!lesson) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div>
        <button
          onClick={() => router.push("/dashboard")}
          className="text-sm text-gray-400 hover:text-gray-600 mb-2 inline-block"
        >
          &larr; Back to dashboard
        </button>
        <h1 className="text-xl font-bold text-gray-900">
          Lesson {lesson.lessonNumber}
          {lesson.topic ? `: ${lesson.topic}` : ""}
        </h1>
        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
          {lesson.createdAt && (
            <span>{formatLessonDate(lesson.createdAt)}</span>
          )}
          {lesson.duration && <span>{Math.max(1, lesson.duration)} min</span>}
          <span
            className={`px-2 py-0.5 rounded-full text-xs ${
              lesson.status === "completed"
                ? "bg-green-100 text-green-700"
                : "bg-yellow-100 text-yellow-700"
            }`}
          >
            {lesson.status}
          </span>
        </div>
      </div>

      {/* Summary */}
      {lesson.summary && (
        <div className="card bg-blue-50 border border-blue-100">
          <p className="text-sm text-gray-700">{lesson.summary}</p>
        </div>
      )}

      {/* Messages */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">Conversation</h3>
        {lesson.messages.length === 0 ? (
          <p className="text-sm text-gray-400">
            No messages yet. Summary will appear after the lesson is processed.
          </p>
        ) : (
          <div className="space-y-3">
            {lesson.messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-primary-500 text-white rounded-br-md"
                      : "bg-gray-100 text-gray-800 rounded-bl-md"
                  }`}
                >
                  <p>{msg.content}</p>
                  <p
                    className={`text-[10px] mt-1 ${
                      msg.role === "user" ? "text-blue-100" : "text-gray-400"
                    }`}
                  >
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
