export function LessonConnecting() {
  return (
    <div className="lesson-bg flex min-h-dvh items-center justify-center">
      <div className="text-center text-white">
        <div className="mx-auto mb-4 size-12 animate-spin rounded-full border-[3px] border-white/20 border-t-white" />
        <p className="text-base font-medium">Connecting...</p>
        <p className="mt-1 text-sm text-white/40">Setting up a secure connection</p>
      </div>
    </div>
  );
}
