"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatLessonDate } from "@/lib/utils";
import { useBackendSession } from "@/hooks/useBackendSession";
import { useApiQuery } from "@/hooks/useApiQuery";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorMessage } from "@/components/ui/ErrorMessage";

export default function DashboardPage() {
  const { user } = useBackendSession();
  const router = useRouter();
  const { data: recentLessons, isLoading, error, refetch } = useApiQuery(
    () => api.lessons.list(),
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          G'day{user?.name ? `, ${user.name.split(" ")[0]}` : ""}!
        </h1>
        <p className="text-gray-500 mt-1">Ready for a chat with Jake?</p>
      </div>

      {/* Start Lesson CTA */}
      <div className="gradient-bg rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold mb-1">Start a lesson</h2>
            <p className="text-blue-100">Have a conversation with Jake, your AI mate</p>
          </div>
          <button
            onClick={() => router.push("/lesson")}
            className="bg-white text-primary-600 font-semibold px-6 py-3 rounded-xl hover:bg-blue-50 transition-colors"
          >
            Let's go!
          </button>
        </div>
      </div>

      {/* Recent Lessons */}
      {isLoading && <LoadingSpinner className="h-32" />}
      {error && <ErrorMessage message={error} onRetry={refetch} />}
      {recentLessons && recentLessons.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Recent lessons</h3>
          <div className="space-y-3">
            {recentLessons.slice(0, 10).map((lesson) => (
              <div
                key={lesson.id}
                onClick={() => router.push(`/lessons/${lesson.id}`)}
                className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {lesson.topic || "Conversation with Jake"}
                  </p>
                  {lesson.summary && (
                    <p className="text-xs text-gray-500 truncate">
                      {lesson.summary}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">
                    {lesson.createdAt ? formatLessonDate(lesson.createdAt) : ""}
                  </p>
                </div>
                <span className="text-xs text-gray-400">
                  {Math.max(1, lesson.duration ?? 0)} min
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
