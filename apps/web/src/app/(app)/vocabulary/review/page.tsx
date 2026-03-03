"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { ReviewSession } from "@/components/vocabulary/ReviewSession";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { useBackendSession } from "@/hooks/useBackendSession";
import { useApiQuery } from "@/hooks/useApiQuery";

export default function VocabularyReviewPage() {
  const { user } = useBackendSession();
  const router = useRouter();
  const { data, isLoading, error, refetch } = useApiQuery(
    useCallback(
      () => user?.id ? api.vocabulary.review(user.id) : Promise.resolve({ words: [] }),
      [user?.id],
    ),
  );
  const words = data?.words ?? [];

  if (isLoading) return <LoadingSpinner className="h-64" />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Vocabulary Review</h1>
      <ReviewSession
        words={words}
        onComplete={() => router.push("/vocabulary")}
      />
    </div>
  );
}
