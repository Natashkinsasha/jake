"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [recentLessons, setRecentLessons] = useState<any[]>([]);

  useEffect(() => {
    const backendToken = (session as any)?.backendToken;
    if (backendToken) {
      localStorage.setItem("session_token", backendToken);
    }

    api.lessons.list().then(setRecentLessons).catch(console.error);
  }, [session]);

  const user = (session as any)?.backendUser;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          G'day{user?.name ? `, ${user.name.split(" ")[0]}` : ""}!
        </h1>
        <p className="text-gray-500 mt-1">Ready for a chat with Jake?</p>
      </div>

      {/* Start Lesson CTA */}
      <div className="gradient-bg rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold mb-1">Start a lesson</h2>
            <p className="text-blue-100">Have a conversation with Jake, your AI mate</p>
          </div>
          <button
            onClick={() => router.push("/lesson")}
            className="bg-white text-primary-600 font-semibold px-6 py-3 rounded-xl hover:bg-blue-50 transition-colors"
          >
            Let's go!
          </button>
        </div>
      </div>

      {/* Recent Lessons */}
      {recentLessons.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Recent lessons</h3>
          <div className="space-y-3">
            {recentLessons.slice(0, 10).map((lesson: any) => (
              <div
                key={lesson.id}
                onClick={() => router.push(`/lessons/${lesson.id}`)}
                className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {lesson.topic || "Conversation with Jake"}
                  </p>
                  {lesson.summary && (
                    <p className="text-xs text-gray-500 truncate">
                      {lesson.summary}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">
                    {lesson.createdAt
                      ? new Date(lesson.createdAt).toLocaleString([], {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : ""}
                  </p>
                </div>
                {lesson.duration && (
                  <span className="text-xs text-gray-400">
                    {lesson.duration} min
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
