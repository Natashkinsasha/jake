"use client";

import { LessonScreen } from "@/components/lesson/LessonScreen";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LessonPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }

    // Store token for WebSocket auth
    const token = (session as any)?.backendToken;
    if (token) {
      localStorage.setItem("session_token", token);
    }
  }, [session, status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen lesson-gradient flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return <LessonScreen />;
}
