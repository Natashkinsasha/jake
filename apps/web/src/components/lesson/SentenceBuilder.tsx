"use client";

import { useState } from "react";

interface SentenceBuilderProps {
  exercise: {
    words: string[];
    hint?: string;
  };
  onSubmit: (answer: string) => void;
}

export function SentenceBuilder({ exercise, onSubmit }: SentenceBuilderProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const available = exercise.words.filter(
    (w, i) => !selected.includes(`${i}-${w}`),
  );

  const addWord = (word: string, index: number) => {
    setSelected([...selected, `${index}-${word}`]);
  };

  const removeWord = (key: string) => {
    setSelected(selected.filter((s) => s !== key));
  };

  const sentence = selected.map((s) => s.split("-").slice(1).join("-")).join(" ");

  return (
    <div>
      <p className="text-gray-700 mb-3">Build the sentence:</p>
      {exercise.hint && (
        <p className="text-sm text-gray-400 mb-3">{exercise.hint}</p>
      )}

      <div className="min-h-[48px] bg-gray-50 rounded-xl p-3 mb-4 flex flex-wrap gap-2 border-2 border-dashed border-gray-200">
        {selected.length === 0 && (
          <span className="text-gray-300 text-sm">Tap words to build a sentence...</span>
        )}
        {selected.map((key) => (
          <button
            key={key}
            onClick={() => removeWord(key)}
            className="px-3 py-1.5 bg-primary-100 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-200 transition-colors"
          >
            {key.split("-").slice(1).join("-")}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {exercise.words.map((word, i) => {
          const key = `${i}-${word}`;
          const isUsed = selected.includes(key);
          return (
            <button
              key={key}
              onClick={() => !isUsed && addWord(word, i)}
              disabled={isUsed}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                isUsed
                  ? "bg-gray-100 text-gray-300 cursor-not-allowed"
                  : "bg-white border border-gray-300 text-gray-700 hover:border-primary-400 hover:text-primary-600"
              }`}
            >
              {word}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => sentence.trim() && onSubmit(sentence.trim())}
        disabled={selected.length === 0}
        className="btn-primary w-full"
      >
        Check
      </button>
    </div>
  );
}
