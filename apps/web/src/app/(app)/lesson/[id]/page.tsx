"use client";

import { LessonScreen } from "@/components/lesson/LessonScreen";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useBackendSession } from "@/hooks/useBackendSession";

export default function LessonByIdPage() {
  const { status } = useBackendSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen lesson-gradient flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return <LessonScreen />;
}
