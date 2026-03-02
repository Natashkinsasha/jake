"use client";

import { useSession, signOut } from "next-auth/react";
import Image from "next/image";

export function Header() {
  const { data: session } = useSession();

  return (
    <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="lg:hidden flex items-center gap-2">
          <span className="text-xl">🎓</span>
          <span className="font-bold text-gray-900">Jake</span>
        </div>

        <div className="hidden lg:block" />

        <div className="flex items-center gap-3">
          {session?.user && (
            <div className="flex items-center gap-2">
              {session.user.image && (
                <Image
                  src={session.user.image}
                  alt=""
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              )}
              <span className="text-sm text-gray-600 hidden sm:inline">
                {session.user.name}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="text-sm text-gray-400 hover:text-gray-600 ml-2"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
