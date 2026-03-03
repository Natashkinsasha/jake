export function LessonWaiting() {
  return (
    <div className="min-h-screen lesson-gradient flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="w-2.5 h-2.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="w-2.5 h-2.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
        <p className="text-white/40 text-sm">Jake is getting ready...</p>
      </div>
    </div>
  );
}
