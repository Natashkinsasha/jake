"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { api } from "@/lib/api";
import type { VocabularyItem, VocabularyStats } from "@/types";

const DEFAULT_STATUS_CONFIG = {
  label: "New",
  badge: "bg-primary-50 text-primary-600",
  border: "border-l-primary-400",
  dot: "bg-primary-400",
} as const;

const STATUS_CONFIG: Record<string, { label: string; badge: string; border: string; dot: string }> = {
  new: DEFAULT_STATUS_CONFIG,
  learning: {
    label: "Learning",
    badge: "bg-amber-50 text-amber-600",
    border: "border-l-amber-400",
    dot: "bg-amber-400",
  },
  learned: {
    label: "Learned",
    badge: "bg-emerald-50 text-emerald-600",
    border: "border-l-emerald-400",
    dot: "bg-emerald-400",
  },
};

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "new", label: "New", dot: "bg-primary-400" },
  { value: "learning", label: "Learning", dot: "bg-amber-400" },
  { value: "learned", label: "Learned", dot: "bg-emerald-400" },
] as const;

function ReviewBar({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-px">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={`bar-${String(i)}`}
            className={`h-1.5 w-3.5 transition-colors first:rounded-l-full last:rounded-r-full ${
              i < count ? "bg-emerald-400" : "bg-gray-100"
            }`}
          />
        ))}
      </div>
      <span className="text-[10px] tabular-nums text-gray-400">{count}/5</span>
    </div>
  );
}

function StatsHeader({ stats }: { stats: VocabularyStats }) {
  const learnedPercent = stats.total > 0 ? Math.round((stats.learned / stats.total) * 100) : 0;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-3xl font-bold tabular-nums text-gray-900">{stats.total}</p>
          <p className="text-sm text-gray-400">total words</p>
        </div>
        <div className="flex gap-5">
          {[
            { value: stats.new, label: "new", color: "text-primary-600" },
            { value: stats.learning, label: "learning", color: "text-amber-500" },
            { value: stats.learned, label: "learned", color: "text-emerald-600" },
          ].map((s) => (
            <div key={s.label} className="text-right">
              <p className={`text-lg font-bold tabular-nums ${s.color}`}>{s.value}</p>
              <p className="text-[11px] uppercase tracking-wider text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Segmented progress bar */}
      <div className="flex h-2 overflow-hidden rounded-full bg-gray-100">
        {stats.learned > 0 && (
          <div
            className="bg-emerald-400 transition-all duration-700 ease-out"
            style={{ width: `${(stats.learned / stats.total) * 100}%` }}
          />
        )}
        {stats.learning > 0 && (
          <div
            className="bg-amber-300 transition-all duration-700 ease-out"
            style={{ width: `${(stats.learning / stats.total) * 100}%` }}
          />
        )}
        {stats.new > 0 && (
          <div
            className="bg-primary-300 transition-all duration-700 ease-out"
            style={{ width: `${(stats.new / stats.total) * 100}%` }}
          />
        )}
      </div>
      <p className="mt-2 text-xs text-gray-400">{learnedPercent}% mastered</p>
      <p className="mt-1 text-[11px] text-gray-300">Use a word 5 times in conversations to mark it as learned</p>
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
      if (statusFilter) {
        filters.status = statusFilter;
      }
      if (topicFilter) {
        filters.topic = topicFilter;
      }

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

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleDelete = async (id: string) => {
    try {
      await api.vocabulary.delete(id);
      setWords((prev) => prev.filter((w) => w.id !== id));
      if (stats) {
        const word = words.find((w) => w.id === id);
        const status = word?.status ?? "new";
        const updated = { ...stats, total: stats.total - 1 };
        if (status === "new") {
          updated["new"] = Math.max(0, updated["new"] - 1);
        } else if (status === "learning") {
          updated.learning = Math.max(0, updated.learning - 1);
        } else {
          updated.learned = Math.max(0, updated.learned - 1);
        }
        setStats(updated);
      }
    } catch {
      // no-op
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-12">
      {/* Header */}
      <div className="animate-fade-in pt-2 opacity-0">
        <Link
          href="/dashboard"
          className="group mb-3 inline-flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-primary-600"
        >
          <svg
            className="size-3.5 transition-transform group-hover:-translate-x-0.5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Dashboard
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Vocabulary</h1>
      </div>

      {/* Stats card */}
      {stats && stats.total > 0 && (
        <div className="animate-stagger-2 animate-slide-up opacity-0">
          <StatsHeader stats={stats} />
        </div>
      )}

      {/* Filters */}
      <div className="animate-stagger-3 flex animate-slide-up flex-wrap items-center gap-2 opacity-0">
        {/* Status pills */}
        <div className="flex gap-1 rounded-xl bg-gray-100/80 p-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                setStatusFilter(f.value);
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                statusFilter === f.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {"dot" in f ? <div className={`size-1.5 rounded-full ${f.dot}`} /> : null}
              {f.label}
            </button>
          ))}
        </div>

        {/* Topic dropdown */}
        {topics.length > 0 && (
          <select
            value={topicFilter}
            onChange={(e) => {
              setTopicFilter(e.target.value);
            }}
            className="cursor-pointer rounded-xl border-0 bg-gray-100/80 px-3 py-2 text-xs font-medium text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All topics</option>
            {topics.map((t) => (
              <option key={t} value={t}>
                {t.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        )}

        {/* Word count badge */}
        {!isLoading && (
          <span className="ml-auto text-xs tabular-nums text-gray-400">
            {words.length} word{words.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Loading / Error */}
      {isLoading ? <LoadingSpinner className="h-32" /> : null}
      {error ? (
        <ErrorMessage
          message={error}
          onRetry={() => {
            void fetchData();
          }}
        />
      ) : null}

      {/* Word list */}
      {!isLoading && words.length > 0 ? (
        <div className="space-y-2">
          {words.map((word, i) => {
            const config = STATUS_CONFIG[word.status] ?? DEFAULT_STATUS_CONFIG;
            return (
              <div
                key={word.id}
                style={i < 20 ? { animationDelay: `${(i + 4) * 0.03}s` } : undefined}
                className={`${i < 20 ? "animate-slide-up opacity-0" : ""} group rounded-xl border border-l-[3px] border-gray-100 bg-white ${config.border} flex items-center gap-4 p-4 transition-all duration-200 hover:shadow-md hover:shadow-gray-900/[0.03]`}
              >
                {/* Word & translation */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-gray-900">{word.word}</span>
                    {word.translation ? <span className="text-sm text-gray-400">{word.translation}</span> : null}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    {word.topic ? (
                      <span className="rounded-md border border-gray-100 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-500">
                        {word.topic.replaceAll("_", " ")}
                      </span>
                    ) : null}
                    <ReviewBar count={word.reviewCount} />
                  </div>
                </div>

                {/* Status & delete */}
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${config.badge}`}
                  >
                    {config.label}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDelete(word.id);
                    }}
                    className="p-1 text-gray-300 transition-colors hover:text-red-400"
                    title="Remove word"
                  >
                    <svg
                      className="size-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Empty state */}
      {!isLoading && words.length === 0 && !error && (
        <div className="animate-fade-in py-20 text-center opacity-0">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-gray-100">
            <svg
              className="size-7 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
              />
            </svg>
          </div>
          <p className="mb-1 text-lg font-semibold text-gray-300">No words yet</p>
          <p className="text-sm text-gray-400">
            {statusFilter || topicFilter ? "No words match your filters" : "Words will appear here after your lessons"}
          </p>
        </div>
      )}
    </div>
  );
}
