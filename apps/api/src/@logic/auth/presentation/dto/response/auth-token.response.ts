export interface AuthTokenResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    currentLevel: string | null;
  };
}
