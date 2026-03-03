import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { syncBackendToken } from "@/lib/session";

export function useBackendSession() {
  const { data: session, status } = useSession();

  useEffect(() => {
    syncBackendToken(session?.backendToken);
  }, [session?.backendToken]);

  return {
    session,
    status,
    user: session?.backendUser ?? null,
    token: session?.backendToken ?? null,
  };
}
