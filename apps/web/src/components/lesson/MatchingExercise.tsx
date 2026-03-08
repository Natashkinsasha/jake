"use client";

import { useState, useCallback, useMemo } from "react";
import type { ExerciseData, ExerciseFeedbackData } from "@/types";
import { cn } from "@/lib/utils";

interface MatchingExerciseProps {
  exercise: ExerciseData;
  feedback?: ExerciseFeedbackData;
  onSubmit: (exerciseId: string, answers: Array<{ word: string; definition: string }>) => void;
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

export function MatchingExercise({ exercise, feedback, onSubmit }: MatchingExerciseProps) {
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [matches, setMatches] = useState<Map<string, string>>(new Map());
  const [submitted, setSubmitted] = useState(false);

  const shuffledDefinitions = useMemo(
    () => shuffleArray(exercise.pairs.map((p) => p.definition)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only shuffle once per exercise
    [exercise.exerciseId],
  );

  const words = exercise.pairs.map((p) => p.word);
  const isComplete = feedback != null;

  const handleWordClick = useCallback((word: string) => {
    if (submitted || isComplete) return;
    setSelectedWord((prev) => (prev === word ? null : word));
  }, [submitted, isComplete]);

  const handleDefinitionClick = useCallback((definition: string) => {
    if (submitted || isComplete || !selectedWord) return;

    setMatches((prev) => {
      const next = new Map(prev);
      // Remove any existing match for this definition
      for (const [w, d] of next) {
        if (d === definition) next.delete(w);
      }
      next.set(selectedWord, definition);
      return next;
    });
    setSelectedWord(null);
  }, [submitted, isComplete, selectedWord]);

  const handleSubmit = useCallback(() => {
    if (matches.size !== words.length) return;
    setSubmitted(true);
    const answers = Array.from(matches.entries()).map(([word, definition]) => ({ word, definition }));
    onSubmit(exercise.exerciseId, answers);
  }, [matches, words.length, onSubmit, exercise.exerciseId]);

  const handleReset = useCallback(() => {
    setMatches(new Map());
    setSelectedWord(null);
  }, []);

  // Compact view after completion
  if (isComplete && feedback) {
    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-4 py-3 mx-4">
        <div className="flex items-center gap-2">
          <span className="text-white/60 text-sm">Matching exercise</span>
          <span className={cn(
            "text-sm font-medium px-2 py-0.5 rounded-full",
            feedback.score === `${feedback.results.length}/${feedback.results.length}`
              ? "bg-emerald-500/20 text-emerald-300"
              : "bg-amber-500/20 text-amber-300",
          )}>
            {feedback.score}
          </span>
        </div>
      </div>
    );
  }

  // Color palette for matched pairs
  const pairColors = [
    "bg-blue-500/20 border-blue-400/40",
    "bg-purple-500/20 border-purple-400/40",
    "bg-teal-500/20 border-teal-400/40",
    "bg-orange-500/20 border-orange-400/40",
    "bg-pink-500/20 border-pink-400/40",
    "bg-cyan-500/20 border-cyan-400/40",
  ];

  const getMatchColor = (word: string, definition: string) => {
    const matchedWords = Array.from(matches.keys());
    const wordIdx = matchedWords.indexOf(word);
    const defWord = Array.from(matches.entries()).find(([, d]) => d === definition)?.[0];
    const defIdx = defWord ? matchedWords.indexOf(defWord) : -1;
    const idx = wordIdx !== -1 ? wordIdx : defIdx;
    return idx !== -1 ? pairColors[idx % pairColors.length] : "";
  };

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-4 py-4 mx-4 space-y-3">
      <p className="text-white/60 text-xs font-medium uppercase tracking-wide">Match words with definitions</p>

      <div className="grid grid-cols-2 gap-3">
        {/* Words column */}
        <div className="space-y-2">
          {words.map((word) => {
            const isSelected = selectedWord === word;
            const isMatched = matches.has(word);
            const matchColor = isMatched ? getMatchColor(word, matches.get(word)!) : "";

            return (
              <button
                key={word}
                type="button"
                onClick={() => handleWordClick(word)}
                disabled={submitted}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-all border",
                  isSelected
                    ? "bg-white/20 border-white/40 text-white"
                    : isMatched
                      ? `${matchColor} text-white/90`
                      : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20",
                )}
              >
                {word}
              </button>
            );
          })}
        </div>

        {/* Definitions column */}
        <div className="space-y-2">
          {shuffledDefinitions.map((def) => {
            const isMatched = Array.from(matches.values()).includes(def);
            const matchColor = isMatched ? getMatchColor("", def) : "";

            return (
              <button
                key={def}
                type="button"
                onClick={() => handleDefinitionClick(def)}
                disabled={submitted || !selectedWord}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-xl text-xs transition-all border",
                  isMatched
                    ? `${matchColor} text-white/90`
                    : selectedWord
                      ? "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20"
                      : "bg-white/5 border-white/10 text-white/60",
                )}
              >
                {def}
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        {matches.size > 0 && !submitted && (
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-white/40 hover:text-white/60 transition-colors"
          >
            Reset
          </button>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={matches.size !== words.length || submitted}
          className={cn(
            "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
            matches.size === words.length && !submitted
              ? "bg-white/20 text-white hover:bg-white/30"
              : "bg-white/5 text-white/30 cursor-not-allowed",
          )}
        >
          {submitted ? "Checking..." : "Check"}
        </button>
      </div>
    </div>
  );
}
