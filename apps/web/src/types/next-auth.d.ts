import "next-auth";

declare module "next-auth" {
  interface Session {
    backendToken?: string;
    backendUser?: {
      id: string;
      email: string;
      name: string;
      avatarUrl: string | null;
      currentLevel: string | null;
    };
  }

  interface User {
    backendToken?: string;
    backendUser?: {
      id: string;
      email: string;
      name: string;
      avatarUrl: string | null;
      currentLevel: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    backendToken?: string;
    backendUser?: {
      id: string;
      email: string;
      name: string;
      avatarUrl: string | null;
      currentLevel: string | null;
    };
  }
}
