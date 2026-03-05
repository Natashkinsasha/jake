const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();

export function createLogger(tag: string) {
  return (...args: unknown[]) => {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const elapsed = ((now - t0) / 1000).toFixed(3);
    console.log(`[${tag} +${elapsed}s]`, ...args);
  };
}
