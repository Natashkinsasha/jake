"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { SettingsDrawer } from "@/components/settings/SettingsDrawer";
import { useBackendSession } from "@/hooks/useBackendSession";

export function AppHeader() {
  const { session, user } = useBackendSession();
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (pathname === "/lesson") return null;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4 lg:px-6">
          <Link
            href="/dashboard"
            className="text-xl font-bold text-primary-700 transition-colors hover:text-primary-500"
          >
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
            <span className="hidden text-sm text-gray-600 sm:block">{user?.name ?? session?.user?.name}</span>
            <button
              type="button"
              onClick={() => {
                setSettingsOpen(true);
              }}
              className="-m-1 rounded-lg p-2.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 active:bg-gray-200"
              title="Settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => {
                void signOut({ callbackUrl: "/login" });
              }}
              className="rounded-lg px-3 py-2 text-sm text-gray-400 transition-colors hover:bg-gray-100 hover:text-red-500 active:bg-gray-200"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <SettingsDrawer
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
        }}
      />
    </>
  );
}
