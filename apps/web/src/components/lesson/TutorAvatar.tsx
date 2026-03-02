"use client";

import { cn } from "@/lib/utils";

interface TutorAvatarProps {
  isSpeaking: boolean;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "w-12 h-12 text-2xl",
  md: "w-16 h-16 text-3xl",
  lg: "w-24 h-24 text-5xl",
};

export function TutorAvatar({ isSpeaking, size = "lg" }: TutorAvatarProps) {
  return (
    <div className="relative flex items-center justify-center">
      {isSpeaking && (
        <div className="absolute inset-0 rounded-full bg-white/20 animate-ping" />
      )}
      <div
        className={cn(
          sizeClasses[size],
          "rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white/30 transition-all",
          isSpeaking && "ring-4 ring-white/40"
        )}
      >
        {"\u{1F9D1}\u{200D}\u{1F3EB}"}
      </div>
    </div>
  );
}
