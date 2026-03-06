"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatLessonDate } from "@/lib/utils";
import { useBackendSession } from "@/hooks/useBackendSession";
import { useApiQuery } from "@/hooks/useApiQuery";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorMessage } from "@/components/ui/ErrorMessage";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { user } = useBackendSession();
  const router = useRouter();
  const { data: recentLessons, isLoading, error, refetch } = useApiQuery(
    () => api.lessons.list(),
  );

  const firstName = user?.name.split(" ")[0];

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-12">
      {/* Greeting */}
      <div className="pt-2 opacity-0 animate-fade-in">
        <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 tracking-tight">
          {getGreeting()}{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-gray-400 mt-2 text-lg">
          Ready for today&apos;s session?
        </p>
      </div>

      {/* Start Lesson CTA */}
      <button
        type="button"
        onClick={() => { router.push("/lesson"); }}
        className="opacity-0 animate-slide-up animate-stagger-2 w-full text-left group relative overflow-hidden rounded-3xl gradient-bg p-8 transition-all duration-300 hover:shadow-xl hover:shadow-primary-900/20 hover:scale-[1.01] active:scale-[0.99]"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-100" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>
              </div>
              <span className="text-blue-200 text-sm font-medium tracking-wide uppercase">Voice Lesson</span>
            </div>
            <h2 className="text-3xl font-bold text-white mb-1">
              Start a conversation
            </h2>
            <p className="text-blue-200 text-base">
              Practice your English with Jake
            </p>
          </div>
          <div className="hidden sm:flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 group-hover:bg-white/20 transition-colors">
            <svg className="w-6 h-6 text-white group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </div>
        </div>
      </button>

      {/* Recent Lessons */}
      {isLoading && <LoadingSpinner className="h-32" />}
      {error && <ErrorMessage message={error} onRetry={refetch} />}
      {recentLessons && recentLessons.length > 0 && (
        <div className="opacity-0 animate-slide-up animate-stagger-4">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">Your lessons</h3>
          <div className="space-y-3">
            {recentLessons.slice(0, 10).map((lesson, i) => (
              <button
                type="button"
                key={lesson.id}
                onClick={() => { router.push(`/lessons/${lesson.id}`); }}
                style={{ animationDelay: `${(i + 5) * 0.05}s` }}
                className="opacity-0 animate-slide-up w-full text-left group flex items-center gap-4 bg-white rounded-2xl border border-gray-100 p-4 hover:border-primary-200 hover:shadow-md hover:shadow-primary-900/5 transition-all duration-200"
              >
                {/* Lesson number badge */}
                <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-primary-50 text-primary-700 font-semibold text-lg flex items-center justify-center group-hover:bg-primary-100 transition-colors">
                  {lesson.lessonNumber}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 group-hover:text-primary-700 transition-colors">
                    {lesson.topic ?? "Conversation with Jake"}
                  </p>
                  {lesson.summary && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {lesson.summary}
                    </p>
                  )}
                </div>

                {/* Meta */}
                <div className="flex-shrink-0 text-right">
                  <p className="text-xs text-gray-400">
                    {lesson.createdAt ? formatLessonDate(lesson.createdAt) : ""}
                  </p>
                  <p className="text-xs text-gray-300 mt-0.5">
                    {Math.max(1, lesson.duration ?? 0)} min
                  </p>
                </div>

                {/* Arrow */}
                <svg className="w-4 h-4 text-gray-300 group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {recentLessons && recentLessons.length === 0 && (
        <div className="opacity-0 animate-fade-in animate-stagger-4 text-center py-12">
          <p className="text-2xl font-bold text-gray-300 mb-2">No lessons yet</p>
          <p className="text-gray-400 text-sm">Start your first conversation with Jake above</p>
        </div>
      )}
    </div>
  );
}
