"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

interface TutorProfile {
  gender: string;
  nationality: string;
  description: string;
  traits: string[];
}

interface TutorVoice {
  id: string;
  name: string;
  gender: string;
}

interface TutorSelection {
  tutorGender: string;
  tutorNationality: string;
  tutorVoiceId: string;
}

interface TutorSetupModalProps {
  open: boolean;
  onComplete: (selection: TutorSelection) => void;
}

const NATIONALITY_LABELS: Record<string, { label: string; flag: string }> = {
  australian: { label: "Australian", flag: "\uD83C\uDDE6\uD83C\uDDFA" },
  british: { label: "British", flag: "\uD83C\uDDEC\uD83C\uDDE7" },
  scottish: { label: "Scottish", flag: "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74\uDB40\uDC7F" },
  american: { label: "American", flag: "\uD83C\uDDFA\uD83C\uDDF8" },
};

export function TutorSetupModal({ open, onComplete }: TutorSetupModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [gender, setGender] = useState<string | null>(null);
  const [nationality, setNationality] = useState<string | null>(null);
  const [voiceId, setVoiceId] = useState<string | null>(null);

  const [profiles, setProfiles] = useState<TutorProfile[]>([]);
  const [voices, setVoices] = useState<TutorVoice[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    void api.tutor.profiles().then(setProfiles);
  }, [open]);

  const fetchVoices = useCallback(async (g: string) => {
    const v = await api.tutor.voices(g);
    setVoices(v);
    const first = v[0];
    if (first) setVoiceId(first.id);
  }, []);

  const handleGenderSelect = (g: string) => {
    setGender(g);
    setNationality(null);
    setVoiceId(null);
    void fetchVoices(g);
    setStep(2);
  };

  const handleNationalitySelect = (n: string) => {
    setNationality(n);
    setStep(3);
  };

  const handleComplete = async () => {
    if (!gender || !nationality || !voiceId) return;
    setSaving(true);
    try {
      await api.auth.updatePreferences({
        tutorGender: gender,
        tutorNationality: nationality,
        tutorVoiceId: voiceId,
      });
      onComplete({ tutorGender: gender, tutorNationality: nationality, tutorVoiceId: voiceId });
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (step === 2) { setStep(1); setNationality(null); }
    if (step === 3) setStep(2);
  };

  const filteredProfiles = profiles.filter((p) => p.gender === gender);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="gradient-bg px-6 py-5">
          <h2 className="text-xl font-bold text-white">Customize your tutor</h2>
          <p className="text-blue-200 text-sm mt-1">
            {step === 1 && "Choose your tutor's gender"}
            {step === 2 && "Choose your tutor's nationality"}
            {step === 3 && "Choose your tutor's voice"}
          </p>
          <div className="flex gap-1.5 mt-3">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? "bg-white" : "bg-white/30"}`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {/* Step 1: Gender */}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-3">
              {(["male", "female"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => { handleGenderSelect(g); }}
                  className={`p-5 rounded-2xl border-2 transition-all duration-200 hover:shadow-md ${
                    gender === g
                      ? "border-primary-500 bg-primary-50"
                      : "border-gray-100 hover:border-primary-200"
                  }`}
                >
                  <div className="text-3xl mb-2">{g === "male" ? "\uD83D\uDC68\u200D\uD83C\uDFEB" : "\uD83D\uDC69\u200D\uD83C\uDFEB"}</div>
                  <p className="font-semibold text-gray-800 capitalize">{g}</p>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Nationality */}
          {step === 2 && (
            <div className="space-y-3">
              {filteredProfiles.map((p) => {
                const nat = NATIONALITY_LABELS[p.nationality];
                return (
                  <button
                    key={p.nationality}
                    type="button"
                    onClick={() => { handleNationalitySelect(p.nationality); }}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 hover:shadow-md ${
                      nationality === p.nationality
                        ? "border-primary-500 bg-primary-50"
                        : "border-gray-100 hover:border-primary-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{nat?.flag}</span>
                      <div>
                        <p className="font-semibold text-gray-800">{nat?.label}</p>
                        <p className="text-sm text-gray-500 mt-0.5">{p.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 3: Voice */}
          {step === 3 && (
            <div className="space-y-3">
              {voices.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => { setVoiceId(v.id); }}
                  className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 hover:shadow-md ${
                    voiceId === v.id
                      ? "border-primary-500 bg-primary-50"
                      : "border-gray-100 hover:border-primary-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      voiceId === v.id ? "bg-primary-500 text-white" : "bg-gray-100 text-gray-500"
                    }`}>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                      </svg>
                    </div>
                    <p className="font-semibold text-gray-800">{v.name}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          {step > 1 && (
            <button
              type="button"
              onClick={handleBack}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
          )}
          {step === 3 && (
            <button
              type="button"
              onClick={() => { void handleComplete(); }}
              disabled={saving || !voiceId}
              className="flex-1 px-5 py-2.5 rounded-xl gradient-bg text-white font-medium hover:shadow-lg transition-all disabled:opacity-50"
            >
              {saving ? "Saving..." : "Start learning"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
