const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();

export function createLogger(_tag: string) {
  return (..._args: unknown[]) => {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const _elapsed = ((now - t0) / 1000).toFixed(3);
  };
}
