export function LessonConnecting() {
  return (
    <div className="min-h-screen lesson-gradient flex items-center justify-center">
      <div className="text-center text-white">
        <div className="w-14 h-14 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-5" />
        <p className="text-lg font-semibold">Connecting to your tutor...</p>
        <p className="text-sm text-white/60 mt-2">
          Setting up a secure connection
        </p>
      </div>
    </div>
  );
}
