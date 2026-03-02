"use client";

interface TutorAvatarProps {
  isSpeaking: boolean;
  size?: "sm" | "md" | "lg";
}

export function TutorAvatar({ isSpeaking, size = "lg" }: TutorAvatarProps) {
  const sizeClasses = {
    sm: "w-12 h-12 text-2xl",
    md: "w-16 h-16 text-3xl",
    lg: "w-24 h-24 text-5xl",
  };

  return (
    <div className="relative flex items-center justify-center">
      {isSpeaking && (
        <div className="absolute inset-0 rounded-full bg-white/20 animate-ping" />
      )}
      <div
        className={`${sizeClasses[size]} rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white/30 ${isSpeaking ? "ring-4 ring-white/40" : ""} transition-all`}
      >
        🧑‍🏫
      </div>
    </div>
  );
}
