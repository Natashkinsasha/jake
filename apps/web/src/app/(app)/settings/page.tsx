"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";
import Image from "next/image";
import { api } from "@/lib/api";
import { useBackendSession } from "@/hooks/useBackendSession";
import { useApiQuery } from "@/hooks/useApiQuery";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import type { UserPreferences } from "@/types";

const correctionStyles = [
  { value: "immediate", label: "Immediate", desc: "Correct me right away" },
  { value: "end_of_lesson", label: "End of lesson", desc: "Save corrections for later" },
  { value: "natural", label: "Natural", desc: "Weave corrections into conversation" },
];

const speeds = [
  { value: "slow", label: "Slow" },
  { value: "normal", label: "Normal" },
  { value: "fast", label: "Fast" },
];

export default function SettingsPage() {
  const { session, user } = useBackendSession();
  const { data: meData, isLoading, error, refetch } = useApiQuery(
    () => api.auth.me(),
  );
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync preferences from API data when it arrives
  if (meData && !preferences && !isLoading) {
    setPreferences(meData.user_preferences ?? {});
  }

  const updatePref = async (key: string, value: string | boolean) => {
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    setSaving(true);
    setSaved(false);
    try {
      await api.auth.updatePreferences({ [key]: value });
      setSaved(true);
      setTimeout(() => { setSaved(false); }, 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <LoadingSpinner className="h-64" />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        {saved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
      </div>

      {/* Profile */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">Profile</h2>
        <div className="flex items-center gap-4">
          {session?.user?.image && (
            <Image src={session.user.image} alt="" width={56} height={56} className="rounded-full" />
          )}
          <div>
            <p className="font-medium text-gray-900">{user?.name ?? session?.user?.name}</p>
            <p className="text-sm text-gray-500">{user?.email ?? session?.user?.email}</p>
            {user?.currentLevel && (
              <span className="inline-block mt-1 text-xs font-medium text-primary-600 bg-primary-50 rounded-full px-2.5 py-0.5">
                Level {user.currentLevel}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Correction Style */}
      {preferences && (
        <>
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Correction Style</h2>
            <div className="space-y-2">
              {correctionStyles.map((style) => (
                <button
                  key={style.value}
                  onClick={() => updatePref("correctionStyle", style.value)}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                    preferences.correctionStyle === style.value
                      ? "border-primary-500 bg-primary-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="font-medium text-gray-900 text-sm">{style.label}</p>
                  <p className="text-xs text-gray-400">{style.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Preferences</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Grammar explanations</p>
                  <p className="text-xs text-gray-400">Explain grammar rules during lesson</p>
                </div>
                <button
                  onClick={() => updatePref("explainGrammar", !preferences.explainGrammar)}
                  className={`w-12 h-7 rounded-full transition-colors ${
                    preferences.explainGrammar ? "bg-primary-500" : "bg-gray-300"
                  } relative`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform ${
                    preferences.explainGrammar ? "translate-x-6" : "translate-x-1"
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Use native language</p>
                  <p className="text-xs text-gray-400">Allow explanations in your language</p>
                </div>
                <button
                  onClick={() => updatePref("useNativeLanguage", !preferences.useNativeLanguage)}
                  className={`w-12 h-7 rounded-full transition-colors ${
                    preferences.useNativeLanguage ? "bg-primary-500" : "bg-gray-300"
                  } relative`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform ${
                    preferences.useNativeLanguage ? "translate-x-6" : "translate-x-1"
                  }`} />
                </button>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Speaking speed</p>
                <div className="flex gap-2">
                  {speeds.map((speed) => (
                    <button
                      key={speed.value}
                      onClick={() => updatePref("speakingSpeed", speed.value)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        preferences.speakingSpeed === speed.value
                          ? "bg-primary-500 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {speed.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="btn-secondary w-full text-red-600 hover:text-red-700 hover:bg-red-50"
      >
        Sign out
      </button>
    </div>
  );
}
