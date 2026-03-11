import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const googleClientId = process.env["GOOGLE_CLIENT_ID"] ?? "";
const googleClientSecret = process.env["GOOGLE_CLIENT_SECRET"] ?? "";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        try {
          const API_URL =
            process.env["INTERNAL_API_URL"] ?? process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:4000";
          const res = await fetch(`${API_URL}/auth/google`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              googleId: account.providerAccountId,
              email: user.email,
              name: user.name,
              avatarUrl: user.image ?? null,
            }),
          });

          if (!res.ok) {
            return false;
          }

          const data = (await res.json()) as {
            token: string;
            user: { id: string; email: string; name: string; avatarUrl: string | null; currentLevel: string | null };
          };
          user.backendToken = data.token;
          user.backendUser = data.user;
          return true;
        } catch {
          return false;
        }
      }
      return true;
    },
    jwt({ token, user }) {
      if (user as typeof user | undefined) {
        token.backendToken = user.backendToken;
        token.backendUser = user.backendUser;
      }
      return token;
    },
    session({ session, token }) {
      session.backendToken = token.backendToken;
      session.backendUser = token.backendUser;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
