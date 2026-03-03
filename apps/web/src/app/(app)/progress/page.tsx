"use client";

import { api } from "@/lib/api";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { useBackendSession } from "@/hooks/useBackendSession";
import { useApiQuery } from "@/hooks/useApiQuery";

const levelOrder = ["A1", "A2", "B1", "B2", "C1", "C2"];

export default function ProgressPage() {
  const { user } = useBackendSession();
  const { data: progress, isLoading, error, refetch } = useApiQuery(
    () => user?.id ? api.progress.get(user.id) : Promise.reject(new Error("No user")),
    [user?.id],
  );

  if (isLoading) return <LoadingSpinner className="h-64" />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;

  const levelIndex = progress?.currentLevel
    ? levelOrder.indexOf(progress.currentLevel)
    : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Progress</h1>

      {/* Level */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">English Level</h2>
        <div className="flex items-center gap-4 mb-3">
          <span className="text-4xl font-bold text-primary-600">
            {progress?.currentLevel || "—"}
          </span>
          <div className="flex-1">
            <ProgressBar value={levelIndex + 1} max={6} />
          </div>
        </div>
        <div className="flex justify-between text-xs text-gray-400">
          {levelOrder.map((level) => (
            <span
              key={level}
              className={level === progress?.currentLevel ? "text-primary-600 font-semibold" : ""}
            >
              {level}
            </span>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card text-center">
          <p className="text-3xl font-bold text-primary-600">
            {progress?.totalLessons ?? 0}
          </p>
          <p className="text-sm text-gray-500 mt-1">Total Lessons</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-green-600">
            {progress?.totalWords ?? 0}
          </p>
          <p className="text-sm text-gray-500 mt-1">Words Learned</p>
        </div>
      </div>

      {/* Grammar */}
      {progress?.grammarTopics && progress.grammarTopics.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Grammar Topics</h2>
          <div className="space-y-4">
            {progress.grammarTopics.map((topic) => (
              <div key={topic.topic}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-gray-700">
                    {topic.topic}
                  </span>
                  <span className="text-xs text-gray-400">
                    {topic.errorCount} error{topic.errorCount !== 1 ? "s" : ""}
                  </span>
                </div>
                <ProgressBar
                  value={topic.level}
                  max={10}
                  color={
                    topic.level >= 7
                      ? "bg-green-500"
                      : topic.level >= 4
                        ? "bg-yellow-400"
                        : "bg-red-400"
                  }
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
