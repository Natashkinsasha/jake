"use client";

import { useRouter } from "next/navigation";

export function LessonCTA() {
  const router = useRouter();

  return (
    <div className="bg-gradient-to-br from-primary-500 via-primary-600 to-accent-600 rounded-2xl p-6 text-white">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold mb-1">Start a lesson</h2>
          <p className="text-blue-100">Have a conversation with Jake, your AI mate</p>
        </div>
        <button
          onClick={() => { router.push("/lesson"); }}
          className="bg-white text-primary-600 font-semibold px-6 py-3 rounded-xl hover:bg-blue-50 transition-colors shrink-0"
        >
          Let's go!
        </button>
      </div>
    </div>
  );
}
