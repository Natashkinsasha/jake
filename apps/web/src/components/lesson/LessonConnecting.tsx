export function LessonConnecting() {
  return (
    <div className="min-h-dvh lesson-gradient flex items-center justify-center">
      <div className="text-center text-white">
        <div className="w-12 h-12 border-[3px] border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
        <p className="text-base font-medium">Connecting...</p>
        <p className="text-sm text-white/40 mt-1">
          Setting up a secure connection
        </p>
      </div>
    </div>
  );
}
