"use client";

import { useState } from "react";
import { ReviewCard } from "./ReviewCard";
import { ProgressBar } from "@/components/ui/ProgressBar";

interface Word {
  id: string;
  word: string;
  strength: number;
  nextReview: string | null;
}

interface ReviewSessionProps {
  words: Word[];
  onComplete: (results: { wordId: string; remembered: boolean }[]) => void;
}

export function ReviewSession({ words, onComplete }: ReviewSessionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<{ wordId: string; remembered: boolean }[]>([]);

  if (words.length === 0) {
    return (
      <div className="text-center py-12">
        <span className="text-5xl block mb-4">🎉</span>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">All caught up!</h3>
        <p className="text-sm text-gray-500">No words to review right now. Come back later!</p>
      </div>
    );
  }

  if (currentIndex >= words.length) {
    const remembered = results.filter((r) => r.remembered).length;
    const total = results.length;

    return (
      <div className="text-center py-12 max-w-md mx-auto">
        <span className="text-5xl block mb-4">📊</span>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Review Complete!</h3>
        <p className="text-gray-500 mb-6">
          You remembered {remembered} out of {total} words
        </p>
        <div className="mb-6">
          <ProgressBar value={remembered} max={total} color={remembered >= total * 0.7 ? "bg-green-500" : "bg-orange-400"} />
          <p className="text-sm text-gray-400 mt-2">{Math.round((remembered / total) * 100)}%</p>
        </div>
        <button onClick={() => onComplete(results)} className="btn-primary">
          Done
        </button>
      </div>
    );
  }

  const word = words[currentIndex];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <span className="text-sm text-gray-400">
          {currentIndex + 1} of {words.length}
        </span>
        <ProgressBar value={currentIndex} max={words.length} className="flex-1 mx-4" />
      </div>
      <ReviewCard
        word={word.word}
        onResult={(remembered) => {
          setResults([...results, { wordId: word.id, remembered }]);
          setCurrentIndex(currentIndex + 1);
        }}
      />
    </div>
  );
}
