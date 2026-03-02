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
        <p className="text-white/80 text-sm">Loading...</p>
      </div>
    );
  }

  return <LessonScreen token={backendToken} />;
}
