"use client";

import { LessonScreen } from "@/components/lesson/LessonScreen";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LessonPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const backendToken = (session as any)?.backendToken as string | undefined;

  if (status === "loading" || !backendToken) {
    return (
      <div className="min-h-screen lesson-gradient flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg font-semibold">Preparing your lesson...</p>
          <p className="text-sm text-white/60 mt-2">
            Authenticating your session
          </p>
        </div>
      </div>
    );
  }

  return <LessonScreen token={backendToken} />;
}
