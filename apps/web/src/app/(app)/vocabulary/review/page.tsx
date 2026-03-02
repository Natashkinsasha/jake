"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { ReviewSession } from "@/components/vocabulary/ReviewSession";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface Word {
  id: string;
  word: string;
  strength: number;
  nextReview: string | null;
}

export default function VocabularyReviewPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = (session as any)?.backendUser;
    if (user?.id) {
      api.vocabulary
        .review(user.id)
        .then((data) => setWords(data.words))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [session]);

  if (loading) return <LoadingSpinner className="h-64" />;

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
