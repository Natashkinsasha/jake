"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
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
    // eslint-disable-next-line sonarjs/pseudo-random -- non-security shuffle for UI display order
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j] as T;
    shuffled[j] = temp as T;
  }
  return shuffled;
}

const PAIR_COLORS = [
  { bg: "bg-sky-500/35", border: "border-sky-400/50", text: "text-sky-100" },
  { bg: "bg-violet-500/35", border: "border-violet-400/50", text: "text-violet-100" },
  { bg: "bg-emerald-500/35", border: "border-emerald-400/50", text: "text-emerald-100" },
  { bg: "bg-amber-500/35", border: "border-amber-400/50", text: "text-amber-100" },
  { bg: "bg-fuchsia-500/35", border: "border-fuchsia-400/50", text: "text-fuchsia-100" },
  { bg: "bg-cyan-500/35", border: "border-cyan-400/50", text: "text-cyan-100" },
];

export function MatchingExercise({ exercise, feedback, onSubmit }: MatchingExerciseProps) {
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [matches, setMatches] = useState<Map<string, string>>(() => new Map());
  const [submitted, setSubmitted] = useState(false);

  const shuffledDefinitions = useMemo(
    () => shuffleArray(exercise.pairs.map((p) => p.definition)),
    [exercise.pairs],
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

  // Reset submitted state if server doesn't respond within 10s
  useEffect(() => {
    if (!submitted) return;
    const timeout = setTimeout(() => { setSubmitted(false); }, 10_000);
    return () => { clearTimeout(timeout); };
  }, [submitted]);

  // Feedback view after completion — shows correct/incorrect answers
  if (feedback) {
    const isPerfect = feedback.score === `${feedback.results.length}/${feedback.results.length}`;
    return (
      <div className="space-y-2.5 rounded-xl border border-white/[0.06] bg-white/[0.05] px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "w-5 h-5 rounded-full flex items-center justify-center",
            isPerfect ? "bg-emerald-500/20" : "bg-amber-500/20",
          )}>
            {isPerfect ? (
              <svg className="size-3 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            ) : (
              <svg className="size-3 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            )}
          </div>
          <span className="text-sm font-medium text-white/60">
            {isPerfect ? "Perfect!" : "Matching exercise"}
          </span>
          <span className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full ml-auto",
            isPerfect
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-amber-500/15 text-amber-300",
          )}>
            {feedback.score}
          </span>
        </div>
        {/* Show individual results */}
        <div className="space-y-1">
          {feedback.results.map((r) => (
            <div key={r.word} className="flex items-center gap-2 text-xs">
              {r.correct ? (
                <svg className="size-3 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                <svg className="size-3 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <span className={r.correct ? "text-white/60" : "font-medium text-white/70"}>{r.word}</span>
              <span className="text-white/25">&mdash;</span>
              <span className="text-white/70">{r.correctDefinition}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const getMatchIndex = (word: string, definition: string) => {
    const matchedWords = Array.from(matches.keys());
    const wordIdx = matchedWords.indexOf(word);
    const defWord = Array.from(matches.entries()).find(([, d]) => d === definition)?.[0];
    const defIdx = defWord ? matchedWords.indexOf(defWord) : -1;
    return wordIdx !== -1 ? wordIdx : defIdx;
  };

  const allMatched = matches.size === words.length;

  return (
    <div className="space-y-3">
      {/* Header */}
      <p className="text-[11px] font-medium uppercase tracking-widest text-white/40">
        {selectedWord ? "Now tap a definition" : "Tap a word to start"}
      </p>

      {/* Two-column grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Words column */}
        <div className="space-y-1.5">
          {words.map((word) => {
            const isSelected = selectedWord === word;
            const isMatched = matches.has(word);
            const colorIdx = isMatched ? getMatchIndex(word, matches.get(word) ?? "") : -1;
            const color = colorIdx >= 0 ? PAIR_COLORS[colorIdx % PAIR_COLORS.length] : null;

            return (
              <button
                key={word}
                type="button"
                onClick={() => { handleWordClick(word); }}
                disabled={submitted}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border",
                  isSelected
                    ? "bg-white/20 border-white/40 text-white"
                    : isMatched && color
                      ? `${color.bg} ${color.border} ${color.text}`
                      : "bg-white/[0.06] border-white/[0.10] text-white/70 hover:bg-white/10 hover:border-white/15",
                )}
              >
                {word}
              </button>
            );
          })}
        </div>

        {/* Definitions column */}
        <div className="space-y-1.5">
          {shuffledDefinitions.map((def) => {
            const isMatched = Array.from(matches.values()).includes(def);
            const colorIdx = isMatched ? getMatchIndex("", def) : -1;
            const color = colorIdx >= 0 ? PAIR_COLORS[colorIdx % PAIR_COLORS.length] : null;

            return (
              <button
                key={def}
                type="button"
                onClick={() => { handleDefinitionClick(def); }}
                disabled={submitted || !selectedWord}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-xl text-xs leading-relaxed transition-all duration-200 border",
                  isMatched && color
                    ? `${color.bg} ${color.border} ${color.text}`
                    : selectedWord
                      ? "bg-white/[0.06] border-white/[0.10] text-white/60 hover:bg-white/10 hover:border-white/15 cursor-pointer"
                      : "bg-white/[0.05] border-white/[0.08] text-white/50",
                )}
              >
                {def}
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        {matches.size > 0 && !submitted && (
          <button
            type="button"
            onClick={handleReset}
            className="text-[11px] tracking-wide text-white/40 transition-colors hover:text-white/60"
          >
            Reset
          </button>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!allMatched || submitted}
          className={cn(
            "px-5 py-2 rounded-xl text-sm font-medium transition-all duration-300",
            allMatched && !submitted
              ? "bg-indigo-500/30 border border-indigo-400/40 text-indigo-100 hover:bg-indigo-500/40 active:scale-95"
              : "bg-white/[0.05] border border-white/[0.08] text-white/25",
          )}
        >
          {submitted ? "Checking..." : "Check"}
        </button>
      </div>
    </div>
  );
}
