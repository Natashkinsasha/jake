"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatLessonDate } from "@/lib/utils";
import { useBackendSession } from "@/hooks/useBackendSession";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { TutorSetupModal } from "@/components/TutorSetupModal";
import { VocabularyWidget } from "@/components/VocabularyWidget";
import type { LessonListItem, UserPreferences } from "@/types";

const PAGE_SIZE = 10;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { user } = useBackendSession();
  const router = useRouter();

  const [greeting, setGreeting] = useState("");
  const [lessons, setLessons] = useState<LessonListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [showTutorSetup, setShowTutorSetup] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchLessons = useCallback(async (offset: number) => {
    const isInitial = offset === 0;
    if (isInitial) setIsLoading(true);
    else setIsLoadingMore(true);
    setError(null);

    try {
      const data = await api.lessons.list(offset, PAGE_SIZE);
      setLessons((prev) => isInitial ? data : [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      if (isInitial) setIsLoading(false);
      else setIsLoadingMore(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    setGreeting(getGreeting());
    void fetchLessons(0);
    void api.auth.me().then((data) => {
      setPreferences(data.user_preferences ?? null);
    });
  }, [fetchLessons]);

  const handleStartLesson = () => {
    if (!preferences?.tutorGender) {
      setShowTutorSetup(true);
    } else {
      router.push("/lesson");
    }
  };

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || isLoading || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void fetchLessons(lessons.length);
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => { observer.disconnect(); };
  }, [hasMore, isLoading, isLoadingMore, lessons.length, fetchLessons]);

  const firstName = user?.name.split(" ")[0];

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-12">
      {/* Greeting */}
      <div className="animate-fade-in pt-2 opacity-0">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 lg:text-5xl">
          {greeting}{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-2 text-lg text-gray-400">
          Ready for today&apos;s session?
        </p>
      </div>

      {/* Start Lesson CTA */}
      <button
        type="button"
        onClick={handleStartLesson}
        className="animate-stagger-2 gradient-bg group relative w-full animate-slide-up overflow-hidden rounded-3xl p-8 text-left opacity-0 transition-all duration-300 hover:scale-[1.01] hover:shadow-xl hover:shadow-primary-900/20 active:scale-[0.99]"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-white/15">
                <svg className="size-5 text-blue-100" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>
              </div>
              <span className="text-sm font-medium uppercase tracking-wide text-blue-200">Voice Lesson</span>
            </div>
            <h2 className="mb-1 text-3xl font-bold text-white">
              Start a conversation
            </h2>
            <p className="text-base text-blue-200">
              Practice your English with Jake
            </p>
          </div>
          <div className="hidden size-14 items-center justify-center rounded-2xl bg-white/10 transition-colors group-hover:bg-white/20 sm:flex">
            <svg className="size-6 text-white transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </div>
        </div>
      </button>

      {/* Vocabulary Widget */}
      <div className="animate-stagger-3 animate-slide-up opacity-0">
        <VocabularyWidget />
      </div>

      {/* Lessons */}
      {isLoading && <LoadingSpinner className="h-32" />}
      {error && !isLoadingMore && <ErrorMessage message={error} onRetry={() => { void fetchLessons(lessons.length > 0 ? lessons.length : 0); }} />}

      {!isLoading && lessons.length > 0 && (
        <div className="animate-stagger-4 animate-slide-up opacity-0">
          <h3 className="mb-4 text-2xl font-bold text-gray-900">Your lessons</h3>
          <div className="space-y-3">
            {lessons.map((lesson, i) => (
              <button
                type="button"
                key={lesson.id}
                onClick={() => { router.push(`/lessons/${lesson.id}`); }}
                style={i < PAGE_SIZE ? { animationDelay: `${(i + 5) * 0.05}s` } : undefined}
                className={`${i < PAGE_SIZE ? "animate-slide-up opacity-0" : ""} group flex w-full items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 text-left transition-all duration-200 hover:border-primary-200 hover:shadow-md hover:shadow-primary-900/5`}
              >
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-lg font-semibold text-primary-700 transition-colors group-hover:bg-primary-100">
                  {lesson.lessonNumber}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 transition-colors group-hover:text-primary-700">
                    {lesson.topic ?? "Conversation with Jake"}
                  </p>
                  {lesson.summary && (
                    <p className="mt-0.5 truncate text-xs text-gray-400">
                      {lesson.summary}
                    </p>
                  )}
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-xs text-gray-400">
                    {lesson.createdAt ? formatLessonDate(lesson.createdAt) : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-300">
                    {Math.max(1, lesson.duration ?? 0)} min
                  </p>
                </div>

                <svg className="size-4 shrink-0 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-primary-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            ))}
          </div>

          {/* Infinite scroll sentinel */}
          {hasMore && <div ref={sentinelRef} className="h-1" />}
          {isLoadingMore && <LoadingSpinner className="mt-4 h-16" />}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && lessons.length === 0 && !error && (
        <div className="animate-stagger-4 animate-fade-in py-12 text-center opacity-0">
          <p className="mb-2 text-2xl font-bold text-gray-300">No lessons yet</p>
          <p className="text-sm text-gray-400">Start your first conversation with Jake above</p>
        </div>
      )}

      <TutorSetupModal
        open={showTutorSetup}
        onClose={() => { setShowTutorSetup(false); }}
        onComplete={() => {
          setShowTutorSetup(false);
          router.push("/lesson");
        }}
      />
    </div>
  );
}
