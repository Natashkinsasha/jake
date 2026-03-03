const TOKEN_KEY = "session_token";

export function syncBackendToken(token: string | undefined): void {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function getBackendToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
