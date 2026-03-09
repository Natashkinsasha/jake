export function LessonWaiting() {
  return (
    <div className="lesson-bg flex min-h-dvh items-center justify-center">
      <div className="text-center text-white">
        <div className="mx-auto mb-4 size-12 animate-spin rounded-full border-[3px] border-white/20 border-t-white" />
        <p className="text-base font-medium">Jake is getting ready...</p>
        <p className="mt-1 text-sm text-white/40">Your lesson will start in a moment</p>
      </div>
    </div>
  );
}
