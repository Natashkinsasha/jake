"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { ProgressBar } from "@/components/ui/ProgressBar";

interface ProgressData {
  currentLevel: string | null;
  grammarTopics: { topic: string; level: number; errorCount: number }[];
  totalLessons: number;
  totalWords: number;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [progress, setProgress] = useState<ProgressData | null>(null);

  useEffect(() => {
    const user = (session as any)?.backendUser;
    if (user?.id) {
      api.progress.get(user.id).then(setProgress).catch(console.error);
    }
  }, [session]);

  const user = (session as any)?.backendUser;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            G'day{user?.name ? `, ${user.name.split(" ")[0]}` : ""}! 👋
          </h1>
          <p className="text-gray-500 mt-1">Ready for a chat with Jake?</p>
        </div>
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

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-3xl font-bold text-primary-600">{progress?.totalLessons ?? 0}</p>
          <p className="text-sm text-gray-500 mt-1">Lessons</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-green-600">{progress?.totalWords ?? 0}</p>
          <p className="text-sm text-gray-500 mt-1">Words learned</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-accent-600">
            {progress?.currentLevel || "—"}
          </p>
          <p className="text-sm text-gray-500 mt-1">Level</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-orange-500">
            {progress?.grammarTopics?.length ?? 0}
          </p>
          <p className="text-sm text-gray-500 mt-1">Grammar topics</p>
        </div>
      </div>

      {/* Weak areas */}
      {progress?.grammarTopics && progress.grammarTopics.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Grammar Focus</h3>
          <div className="space-y-3">
            {progress.grammarTopics.slice(0, 5).map((topic) => (
              <div key={topic.topic}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">{topic.topic}</span>
                  <span className="text-xs text-gray-400">{topic.errorCount} errors</span>
                </div>
                <ProgressBar value={topic.level} max={10} color="bg-orange-400" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
