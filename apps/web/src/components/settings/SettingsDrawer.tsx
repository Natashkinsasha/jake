"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { BackendUser, UserPreferences } from "@/types";

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
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void api.auth.me().then((res) => {
      setUser(res.users);
      setPrefs(res.user_preferences ?? {});
      setLoading(false);
    }).catch(() => { setLoading(false); });
  }, [open]);

  const save = useCallback(async (patch: Partial<UserPreferences>) => {
    setPrefs((prev) => prev ? { ...prev, ...patch } : patch);
    try {
      await api.auth.updatePreferences(patch);
    } catch {
      // Silently fail — preference will be stale until next reload
    }
  }, []);

  if (!open) return null;

  return (
    <>
      <div
        ref={backdropRef}
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />
      <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-xl z-50 overflow-y-auto animate-slide-in-right">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="p-4 text-sm text-gray-400">Loading...</div>
        ) : (
          <div className="p-4 space-y-6">
            {user && (
              <section>
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Profile</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Name</span>
                    <span className="text-gray-900 font-medium">{user.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Email</span>
                    <span className="text-gray-900 text-right truncate ml-2">{user.email}</span>
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
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Voice</h3>
              <div className="space-y-4">
                <SelectField
                  label="TTS Model"
                  value={prefs?.ttsModel ?? "eleven_turbo_v2_5"}
                  options={TTS_MODELS.map((m) => ({ value: m.value, label: `${m.label} (${m.desc})` }))}
                  onChange={(v) => { void save({ ttsModel: v }); }}
                />
                <SelectField
                  label="Speaking Speed"
                  value={prefs?.speakingSpeed ?? "very_slow"}
                  options={SPEEDS.map((s) => ({ value: s.value, label: s.label }))}
                  onChange={(v) => { void save({ speakingSpeed: v }); }}
                />
              </div>
            </section>

            <section>
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Lesson</h3>
              <div className="space-y-4">
                <SelectField
                  label="Correction Style"
                  value={prefs?.correctionStyle ?? "immediate"}
                  options={CORRECTION_STYLES.map((c) => ({ value: c.value, label: c.label }))}
                  onChange={(v) => { void save({ correctionStyle: v }); }}
                />
                <ToggleField
                  label="Explain Grammar"
                  checked={prefs?.explainGrammar ?? true}
                  onChange={(v) => { void save({ explainGrammar: v }); }}
                />
                <ToggleField
                  label="Use Native Language"
                  checked={prefs?.useNativeLanguage ?? false}
                  onChange={(v) => { void save({ useNativeLanguage: v }); }}
                />
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  );
}

function SelectField({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => { onChange(e.target.value); }}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function ToggleField({ label, checked, onChange }: {
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
        onClick={() => { onChange(!checked); }}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? "bg-primary-600" : "bg-gray-200"}`}
      >
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}
