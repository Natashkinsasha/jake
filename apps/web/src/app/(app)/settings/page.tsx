"use client";

import { useSession, signOut } from "next-auth/react";
import Image from "next/image";

export default function SettingsPage() {
  const { data: session } = useSession();
  const user = (session as any)?.backendUser;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Profile */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">Profile</h2>
        <div className="flex items-center gap-4">
          {session?.user?.image && (
            <Image
              src={session.user.image}
              alt=""
              width={56}
              height={56}
              className="rounded-full"
            />
          )}
          <div>
            <p className="font-medium text-gray-900">{user?.name || session?.user?.name}</p>
            <p className="text-sm text-gray-500">{user?.email || session?.user?.email}</p>
            {user?.currentLevel && (
              <span className="inline-block mt-1 text-xs font-medium text-primary-600 bg-primary-50 rounded-full px-2.5 py-0.5">
                Level {user.currentLevel}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Preferences placeholder */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">Lesson Preferences</h2>
        <div className="space-y-4 text-sm text-gray-500">
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span>Correction style</span>
            <span className="text-gray-900 font-medium">Gentle</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span>Speaking speed</span>
            <span className="text-gray-900 font-medium">Normal</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span>Grammar explanations</span>
            <span className="text-gray-900 font-medium">Yes</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span>Tutor</span>
            <span className="text-gray-900 font-medium">Jake 🇦🇺</span>
          </div>
        </div>
      </div>

      {/* Sign Out */}
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="btn-secondary w-full text-red-600 hover:text-red-700 hover:bg-red-50"
      >
        Sign out
      </button>
    </div>
  );
}
