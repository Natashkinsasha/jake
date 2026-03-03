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
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-2xl mx-auto px-4 lg:px-6 flex items-center justify-between h-14">
        <Link href="/dashboard" className="font-bold text-lg text-primary-600">
          Jake
        </Link>
        <div className="flex items-center gap-3">
          {session?.user?.image && (
            <Image
              src={session.user.image}
              alt=""
              width={32}
              height={32}
              className="rounded-full"
            />
          )}
          <span className="text-sm text-gray-700 hidden sm:block">
            {user?.name ?? session?.user?.name}
          </span>
          <button
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
