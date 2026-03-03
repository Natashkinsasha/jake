"use client";

import { useState } from "react";

interface ReviewCardProps {
  word: string;
  onResult: (remembered: boolean) => void;
}

export function ReviewCard({ word, onResult }: ReviewCardProps) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 max-w-md mx-auto text-center">
      <p className="text-sm text-gray-400 mb-6">Do you remember this word?</p>

      <div className="min-h-[120px] flex items-center justify-center">
        <h2 className="text-3xl font-bold text-gray-900">{word}</h2>
      </div>

      {!revealed ? (
        <button
          onClick={() => { setRevealed(true); }}
          className="btn-secondary w-full mt-4"
        >
          Show answer
        </button>
      ) : (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-gray-500 mb-4">Did you remember it?</p>
          <div className="flex gap-3">
            <button
              onClick={() => { onResult(false); }}
              className="flex-1 px-4 py-3 rounded-xl bg-red-50 text-red-600 font-semibold hover:bg-red-100 transition-colors"
            >
              Forgot
            </button>
            <button
              onClick={() => { onResult(true); }}
              className="flex-1 px-4 py-3 rounded-xl bg-green-50 text-green-600 font-semibold hover:bg-green-100 transition-colors"
            >
              Remembered
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
