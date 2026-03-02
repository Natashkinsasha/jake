"use client";

import { useRouter } from "next/navigation";

interface LessonSummaryProps {
  lessonId: string;
  messageCount: number;
  onClose: () => void;
}

export function LessonSummary({ lessonId, messageCount, onClose }: LessonSummaryProps) {
  const router = useRouter();
  const userMessages = Math.floor(messageCount / 2);

  return (
    <div className="min-h-screen lesson-gradient flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <span className="text-5xl block mb-4">🎉</span>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Great lesson, mate!</h2>
        <p className="text-gray-500 mb-6">Jake says: "No worries, you did heaps well today!"</p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-2xl font-bold text-primary-600">{userMessages}</p>
            <p className="text-xs text-gray-400">Messages sent</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-2xl font-bold text-green-600">{messageCount}</p>
            <p className="text-xs text-gray-400">Total exchanges</p>
          </div>
        </div>

        <p className="text-sm text-gray-400 mb-6">
          Jake is analyzing your lesson and preparing homework...
        </p>

        <div className="space-y-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="btn-primary w-full"
          >
            Back to Dashboard
          </button>
          <button
            onClick={() => router.push("/homework")}
            className="btn-secondary w-full"
          >
            Check Homework
          </button>
        </div>
      </div>
    </div>
  );
}
