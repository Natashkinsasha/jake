const log = (...args: unknown[]) => { console.log("[Audio]", ...args); };

/** Unlock audio playback on user gesture (call from mic permission handler) */
export function unlockAudio() {
  try {
    const ctx = new AudioContext();
    void ctx.resume().then(() => {
      log("AudioContext unlocked, state:", ctx.state);
      void ctx.close();
    });
  } catch {}
}
