"use client";

import { signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBackendSession } from "@/hooks/useBackendSession";

export function AppHeader() {
  const { session, user } = useBackendSession();
  const pathname = usePathname();

  if (pathname === "/lesson") return null;

  return (
    <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-30">
      <div className="max-w-2xl mx-auto px-4 lg:px-6 flex items-center justify-between h-14">
        <Link href="/dashboard" className="font-bold text-xl text-primary-700 hover:text-primary-500 transition-colors">
          Jake
        </Link>
        <div className="flex items-center gap-3">
          {session?.user?.image && (
            <Image
              src={session.user.image}
              alt=""
              width={32}
              height={32}
              className="rounded-full ring-2 ring-gray-100"
            />
          )}
          <span className="text-sm text-gray-600 hidden sm:block">
            {user?.name ?? session?.user?.name}
          </span>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-sm text-gray-400 hover:text-red-500 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
