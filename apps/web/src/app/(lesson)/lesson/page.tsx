"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LessonScreen } from "@/components/lesson/LessonScreen";
import { useBackendSession } from "@/hooks/useBackendSession";

export default function LessonPage() {
  const { token, status } = useBackendSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading" || !token) {
    return (
      <div className="lesson-bg flex min-h-screen items-center justify-center">
        <p className="text-sm text-white/80">Loading...</p>
      </div>
    );
  }

  return <LessonScreen token={token} />;
}
