"use client";

import Link from "next/link";
import { api } from "@/lib/api";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { useBackendSession } from "@/hooks/useBackendSession";
import { useApiQuery } from "@/hooks/useApiQuery";

export default function VocabularyPage() {
  const { user } = useBackendSession();
  const { data, isLoading, error, refetch } = useApiQuery(
    () => user?.id ? api.vocabulary.list(user.id) : Promise.resolve({ words: [] }),
    [user?.id],
  );
  const words = data?.words ?? [];

  if (isLoading) return <LoadingSpinner className="h-64" />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Vocabulary</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{words.length} words</span>
          {words.length > 0 && (
            <Link
              href="/vocabulary/review"
              className="btn-primary text-sm px-4 py-2"
            >
              Start Review
            </Link>
          )}
        </div>
      </div>

      {words.length === 0 ? (
        <EmptyState
          icon="📝"
          title="No vocabulary yet"
          description="Words from your lessons will appear here"
          action={{ label: "Start a lesson", href: "/lesson" }}
        />
      ) : (
        <div className="grid gap-3">
          {words.map((word) => (
            <div key={word.id} className="card flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">{word.word}</p>
                {word.nextReview && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Review: {new Date(word.nextReview).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="w-24">
                  <ProgressBar
                    value={word.strength}
                    max={5}
                    color={
                      word.strength >= 4
                        ? "bg-green-500"
                        : word.strength >= 2
                          ? "bg-yellow-400"
                          : "bg-red-400"
                    }
                  />
                </div>
                <span className="text-xs text-gray-400 w-8 text-right">
                  {word.strength}/5
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
