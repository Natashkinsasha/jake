"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import type { VocabularyItem, VocabularyStats } from "@/types";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "bg-blue-100 text-blue-700" },
  learning: { label: "Learning", color: "bg-amber-100 text-amber-700" },
  learned: { label: "Learned", color: "bg-emerald-100 text-emerald-700" },
};

function ReviewDots({ count }: { count: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full ${i < count ? "bg-emerald-500" : "bg-gray-200"}`}
        />
      ))}
    </div>
  );
}

export default function VocabularyPage() {
  const [words, setWords] = useState<VocabularyItem[]>([]);
  const [stats, setStats] = useState<VocabularyStats | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [topicFilter, setTopicFilter] = useState<string>("");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const filters: { status?: string; topic?: string } = {};
      if (statusFilter) filters.status = statusFilter;
      if (topicFilter) filters.topic = topicFilter;

      const [wordsData, statsData, topicsData] = await Promise.all([
        api.vocabulary.list(filters),
        api.vocabulary.stats(),
        api.vocabulary.topics(),
      ]);
      setWords(wordsData);
      setStats(statsData);
      setTopics(topicsData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, topicFilter]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const handleDelete = async (id: string) => {
    try {
      await api.vocabulary.delete(id);
      setWords((prev) => prev.filter((w) => w.id !== id));
      if (stats) {
        setStats({ ...stats, total: stats.total - 1 });
      }
    } catch {}
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <div className="pt-2 opacity-0 animate-fade-in">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Vocabulary</h1>
      </div>

      {/* Stats */}
      {stats && stats.total > 0 && (
        <div className="opacity-0 animate-slide-up animate-stagger-2 grid grid-cols-4 gap-3">
          {[
            { label: "Total", value: stats.total, color: "text-gray-900" },
            { label: "New", value: stats.new, color: "text-blue-600" },
            { label: "Learning", value: stats.learning, color: "text-amber-500" },
            { label: "Learned", value: stats.learned, color: "text-emerald-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="opacity-0 animate-slide-up animate-stagger-3 flex gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); }}
          className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="learning">Learning</option>
          <option value="learned">Learned</option>
        </select>

        <select
          value={topicFilter}
          onChange={(e) => { setTopicFilter(e.target.value); }}
          className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All topics</option>
          {topics.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Loading / Error */}
      {isLoading && <LoadingSpinner className="h-32" />}
      {error && <ErrorMessage message={error} onRetry={() => { void fetchData(); }} />}

      {/* Word list */}
      {!isLoading && words.length > 0 && (
        <div className="opacity-0 animate-slide-up animate-stagger-4 space-y-2">
          {words.map((word, i) => {
            const statusInfo = STATUS_LABELS[word.status] ?? { label: "New", color: "bg-blue-100 text-blue-700" };
            return (
              <div
                key={word.id}
                style={i < 20 ? { animationDelay: `${(i + 5) * 0.03}s` } : undefined}
                className={`${i < 20 ? "opacity-0 animate-slide-up" : ""} bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 hover:border-gray-200 transition-colors`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{word.word}</span>
                    {word.topic && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{word.topic}</span>
                    )}
                  </div>
                  {word.translation && (
                    <p className="text-sm text-gray-400 mt-0.5">{word.translation}</p>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <ReviewDots count={word.reviewCount} />
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => { void handleDelete(word.id); }}
                    className="text-gray-300 hover:text-red-400 transition-colors p-1"
                    title="Remove word"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && words.length === 0 && !error && (
        <div className="text-center py-16">
          <p className="text-2xl font-bold text-gray-300 mb-2">No words yet</p>
          <p className="text-gray-400 text-sm">Words will appear here after your lessons</p>
        </div>
      )}
    </div>
  );
}
