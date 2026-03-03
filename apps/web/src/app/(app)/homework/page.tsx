"use client";

import { api } from "@/lib/api";
import { HomeworkCard } from "@/components/homework/HomeworkCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { useApiQuery } from "@/hooks/useApiQuery";

export default function HomeworkPage() {
  const { data: homeworks, isLoading, error, refetch } = useApiQuery(
    () => api.homework.list(),
  );

  if (isLoading) return <LoadingSpinner className="h-64" />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Homework</h1>

      {!homeworks || homeworks.length === 0 ? (
        <EmptyState
          icon="📚"
          title="No homework yet"
          description="Complete a lesson and Jake will create exercises just for you"
          action={{ label: "Start a lesson", href: "/lesson" }}
        />
      ) : (
        <div className="space-y-3">
          {homeworks.map((hw) => (
            <HomeworkCard
              key={hw.id}
              id={hw.id}
              lessonDate={hw.createdAt}
              exerciseCount={hw.exercises.length || 0}
              score={hw.score}
              completedAt={hw.completedAt}
            />
          ))}
        </div>
      )}
    </div>
  );
}
