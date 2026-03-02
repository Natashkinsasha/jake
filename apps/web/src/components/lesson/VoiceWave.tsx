"use client";

interface VoiceWaveProps {
  isActive: boolean;
}

export function VoiceWave({ isActive }: VoiceWaveProps) {
  const bars = 5;

  return (
    <div className="flex items-center justify-center gap-1 h-8">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className={`w-1 rounded-full bg-white transition-all duration-150 ${
            isActive ? "animate-wave" : "h-2"
          }`}
          style={{
            animationDelay: isActive ? `${i * 0.15}s` : undefined,
            height: isActive ? undefined : "8px",
          }}
        />
      ))}
    </div>
  );
}
