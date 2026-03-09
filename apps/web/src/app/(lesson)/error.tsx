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
    <div className="lesson-bg flex min-h-screen items-center justify-center p-4">
      <div className="max-w-md text-center">
        <h1 className="mb-2 text-2xl font-bold text-white">Lesson interrupted</h1>
        <p className="mb-6 text-white/60">Something went wrong during your lesson.</p>
        <button
          type="button"
          onClick={() => { router.push("/dashboard"); }}
          className="rounded-xl bg-white px-6 py-3 font-semibold text-primary-600 transition-colors hover:bg-blue-50"
        >
          Back to dashboard
        </button>
      </div>
    </div>
  );
}
