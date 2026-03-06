"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LessonError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("Lesson error:", error);
  }, [error]);

  return (
    <div className="min-h-screen lesson-gradient flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-white mb-2">Lesson interrupted</h1>
        <p className="text-white/60 mb-6">Something went wrong during your lesson.</p>
        <button
          type="button"
          onClick={() => { router.push("/dashboard"); }}
          className="bg-white text-primary-600 font-semibold px-6 py-3 rounded-xl hover:bg-blue-50 transition-colors"
        >
          Back to dashboard
        </button>
      </div>
    </div>
  );
}
