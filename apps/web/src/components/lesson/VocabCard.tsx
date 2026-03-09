"use client";

interface VocabHighlight {
  word: string;
  translation: string;
  topic: string;
}

interface VocabCardProps {
  highlights: VocabHighlight[];
  reviewedWords: string[];
}

export function VocabCard({ highlights, reviewedWords }: VocabCardProps) {
  if (highlights.length === 0) return null;

  return (
    <div className="fixed bottom-24 left-1/2 z-30 flex max-w-md -translate-x-1/2 flex-wrap justify-center gap-2">
      {highlights.slice(-5).map((h) => {
        const isReviewed = reviewedWords.includes(h.word);
        return (
          <div
            key={h.word}
            className={`animate-fade-in rounded-xl border px-3 py-2 shadow-lg backdrop-blur-sm transition-all duration-300 ${
              isReviewed
                ? "border-emerald-200 bg-emerald-50/90"
                : "border-gray-200 bg-white/90"
            }`}
          >
            <div className="flex items-center gap-2">
              {isReviewed && (
                <svg className="size-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
              <span className="text-sm font-medium text-gray-900">{h.word}</span>
              <span className="text-sm text-gray-400">&mdash;</span>
              <span className="text-sm text-gray-500">{h.translation}</span>
            </div>
            <span className="text-xs text-gray-400">{h.topic}</span>
          </div>
        );
      })}
    </div>
  );
}
