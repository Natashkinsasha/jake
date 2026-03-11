"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { BackendUser, UserPreferences } from "@/types";

const NATIONALITIES = [
  { value: "australian", label: "Australian" },
  { value: "british", label: "British" },
  { value: "scottish", label: "Scottish" },
  { value: "american", label: "American" },
] as const;

const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
] as const;

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
}

const TTS_MODELS = [
  { value: "eleven_turbo_v2_5", label: "Turbo v2.5", desc: "Fast" },
  { value: "eleven_multilingual_v2", label: "Multilingual v2", desc: "Best quality" },
  { value: "eleven_flash_v2_5", label: "Flash v2.5", desc: "Fastest" },
] as const;

const SPEEDS = [
  { value: "very_slow", label: "Very Slow" },
  { value: "slow", label: "Slow" },
  { value: "natural", label: "Natural" },
  { value: "fast", label: "Fast" },
  { value: "very_fast", label: "Very Fast" },
] as const;

const CORRECTION_STYLES = [
  { value: "immediate", label: "Immediate" },
  { value: "end_of_lesson", label: "End of Lesson" },
  { value: "natural", label: "Natural" },
] as const;

export function SettingsDrawer({ open, onClose }: SettingsDrawerProps) {
  const [user, setUser] = useState<BackendUser | null>(null);
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [voices, setVoices] = useState<{ id: string; name: string; gender: string }[]>([]);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void api.auth
      .me()
      .then(async (res) => {
        setUser(res.users);
        const p = res.user_preferences ?? {};
        setPrefs(p);
        if (p.tutorGender) {
          const v = await api.tutor.voices(p.tutorGender);
          setVoices(v);
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [open]);

  const save = useCallback(async (patch: Partial<UserPreferences>) => {
    setPrefs((prev) => (prev ? { ...prev, ...patch } : patch));
    try {
      await api.auth.updatePreferences(patch);
    } catch {
      // Silently fail — preference will be stale until next reload
    }
  }, []);

  const handleReset = useCallback(async () => {
    setResetting(true);
    setResetError(false);
    try {
      await api.auth.resetAccount();
      setShowResetConfirm(false);
      onClose();
      window.location.reload();
    } catch {
      setResetting(false);
      setResetError(true);
    }
  }, [onClose]);

  if (!open) return null;

  return (
    <>
      <div
        ref={backdropRef}
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div className="animate-slide-in-right fixed right-0 top-0 z-50 h-full w-80 overflow-y-auto bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
          <button type="button" onClick={onClose} className="p-1 text-gray-400 transition-colors hover:text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="p-4 text-sm text-gray-400">Loading...</div>
        ) : (
          <div className="space-y-6 p-4">
            {user && (
              <section>
                <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-400">Profile</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Name</span>
                    <span className="font-medium text-gray-900">{user.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Email</span>
                    <span className="ml-2 truncate text-right text-gray-900">{user.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Level</span>
                    <span className="text-gray-900">{user.currentLevel ?? "Not set"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Native Language</span>
                    <span className="text-gray-900">{user.nativeLanguage ?? "Not set"}</span>
                  </div>
                </div>
              </section>
            )}

            <section>
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-400">Tutor</h3>
              <div className="space-y-4">
                <SelectField
                  label="Gender"
                  value={prefs?.tutorGender ?? ""}
                  options={[
                    { value: "", label: "Not set" },
                    ...GENDERS.map((g) => ({ value: g.value, label: g.label })),
                  ]}
                  onChange={(v) => {
                    void save({ tutorGender: v || null });
                    if (v) {
                      void api.tutor.voices(v).then((newVoices) => {
                        setVoices(newVoices);
                        if (newVoices[0]) void save({ tutorVoiceId: newVoices[0].id });
                      });
                    }
                  }}
                />
                <SelectField
                  label="Nationality"
                  value={prefs?.tutorNationality ?? ""}
                  options={[
                    { value: "", label: "Not set" },
                    ...NATIONALITIES.map((n) => ({ value: n.value, label: n.label })),
                  ]}
                  onChange={(v) => {
                    void save({ tutorNationality: v || null });
                  }}
                />
                {voices.length > 0 && (
                  <SelectField
                    label="Voice"
                    value={prefs?.tutorVoiceId ?? ""}
                    options={voices.map((v) => ({ value: v.id, label: v.name }))}
                    onChange={(v) => {
                      void save({ tutorVoiceId: v });
                    }}
                  />
                )}
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-400">Voice</h3>
              <div className="space-y-4">
                <SelectField
                  label="TTS Model"
                  value={prefs?.ttsModel ?? "eleven_turbo_v2_5"}
                  options={TTS_MODELS.map((m) => ({ value: m.value, label: `${m.label} (${m.desc})` }))}
                  onChange={(v) => {
                    void save({ ttsModel: v });
                  }}
                />
                <SelectField
                  label="Speaking Speed"
                  value={prefs?.speakingSpeed ?? "very_slow"}
                  options={SPEEDS.map((s) => ({ value: s.value, label: s.label }))}
                  onChange={(v) => {
                    void save({ speakingSpeed: v });
                  }}
                />
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-400">Lesson</h3>
              <div className="space-y-4">
                <SelectField
                  label="Correction Style"
                  value={prefs?.correctionStyle ?? "immediate"}
                  options={CORRECTION_STYLES.map((c) => ({ value: c.value, label: c.label }))}
                  onChange={(v) => {
                    void save({ correctionStyle: v });
                  }}
                />
                <ToggleField
                  label="Explain Grammar"
                  checked={prefs?.explainGrammar ?? true}
                  onChange={(v) => {
                    void save({ explainGrammar: v });
                  }}
                />
                <ToggleField
                  label="Use Native Language"
                  checked={prefs?.useNativeLanguage ?? false}
                  onChange={(v) => {
                    void save({ useNativeLanguage: v });
                  }}
                />
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-400">Account</h3>
              <button
                type="button"
                onClick={() => {
                  setShowResetConfirm(true);
                }}
                className="w-full rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
              >
                Reset Account
              </button>
            </section>
          </div>
        )}
      </div>

      {showResetConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="w-80 rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="mb-2 text-lg font-semibold text-gray-900">Reset Account?</h3>
            <p className="mb-4 text-sm text-gray-500">
              All lessons, progress, vocabulary, and memory will be permanently deleted. Your settings will be reset to
              defaults.
            </p>
            {resetError && <p className="mb-3 text-sm text-red-600">Something went wrong. Please try again.</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowResetConfirm(false);
                  setResetError(false);
                }}
                className="flex-1 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
                disabled={resetting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleReset();
                }}
                className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                disabled={resetting}
              >
                {resetting ? "Resetting..." : "Reset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <select
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => {
          onChange(!checked);
        }}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? "bg-primary-600" : "bg-gray-200"}`}
      >
        <span
          className={`inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`}
        />
      </button>
    </div>
  );
}
