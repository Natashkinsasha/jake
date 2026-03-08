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
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 flex flex-wrap gap-2 justify-center max-w-md">
      {/* eslint-disable-next-line @eslint-react/no-array-index-key -- word may repeat */}
    {highlights.slice(-5).map((h, i) => {
        const isReviewed = reviewedWords.includes(h.word);
        return (
          <div
            key={`${h.word}-${i}`}
            className={`animate-fade-in px-3 py-2 rounded-xl border backdrop-blur-sm shadow-lg transition-all duration-300 ${
              isReviewed
                ? "bg-emerald-50/90 border-emerald-200"
                : "bg-white/90 border-gray-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {isReviewed && (
                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
              <span className="font-medium text-gray-900 text-sm">{h.word}</span>
              <span className="text-gray-400 text-sm">&mdash;</span>
              <span className="text-gray-500 text-sm">{h.translation}</span>
            </div>
            <span className="text-xs text-gray-400">{h.topic}</span>
          </div>
        );
      })}
    </div>
  );
}
