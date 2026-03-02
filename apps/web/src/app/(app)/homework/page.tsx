"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { HomeworkCard } from "@/components/homework/HomeworkCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function HomeworkPage() {
  const [homeworks, setHomeworks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.homework
      .list()
      .then(setHomeworks)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner className="h-64" />;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Homework</h1>

      {homeworks.length === 0 ? (
        <EmptyState
          icon="📚"
          title="No homework yet"
          description="Complete a lesson and Jake will create exercises just for you"
          action={{ label: "Start a lesson", href: "/lesson" }}
        />
      ) : (
        <div className="space-y-3">
          {homeworks.map((hw: any) => (
            <HomeworkCard
              key={hw.id}
              id={hw.id}
              lessonDate={hw.createdAt}
              exerciseCount={hw.exercises?.length || 0}
              score={hw.score}
              completedAt={hw.completedAt}
            />
          ))}
        </div>
      )}
    </div>
  );
}
