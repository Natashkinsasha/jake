"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
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
  previewUrl: string;
}

interface TutorSelection {
  tutorGender: string;
  tutorNationality: string;
  tutorVoiceId: string;
}

interface TutorSetupModalProps {
  open: boolean;
  onComplete: (selection: TutorSelection) => void;
  onClose: () => void;
}

const NATIONALITY_LABELS: Record<string, { label: string; flag: string }> = {
  australian: { label: "Australian", flag: "\uD83C\uDDE6\uD83C\uDDFA" },
  british: { label: "British", flag: "\uD83C\uDDEC\uD83C\uDDE7" },
  scottish: { label: "Scottish", flag: "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74\uDB40\uDC7F" },
  american: { label: "American", flag: "\uD83C\uDDFA\uD83C\uDDF8" },
};

export function TutorSetupModal({ open, onComplete, onClose }: TutorSetupModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [gender, setGender] = useState<string | null>(null);
  const [nationality, setNationality] = useState<string | null>(null);
  const [voiceId, setVoiceId] = useState<string | null>(null);

  const [profiles, setProfiles] = useState<TutorProfile[]>([]);
  const [voices, setVoices] = useState<TutorVoice[]>([]);
  const [saving, setSaving] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!open) {
      stopPreview();
      return;
    }
    void api.tutor.profiles().then(setProfiles);
  }, [open]);

  const fetchVoices = useCallback(async (g: string) => {
    const v = await api.tutor.voices(g);
    setVoices(v);
    const first = v[0];
    if (first) setVoiceId(first.id);
  }, []);

  const stopPreview = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingVoiceId(null);
  };

  const togglePreview = (voice: TutorVoice) => {
    if (playingVoiceId === voice.id) {
      stopPreview();
      return;
    }

    stopPreview();
    const audio = new Audio(voice.previewUrl);
    audioRef.current = audio;
    setPlayingVoiceId(voice.id);
    audio.addEventListener("ended", () => { setPlayingVoiceId(null); });
    audio.play().catch(() => { setPlayingVoiceId(null); });
  };

  const handleGenderSelect = (g: string) => {
    setGender(g);
    setNationality(null);
    setVoiceId(null);
    stopPreview();
    void fetchVoices(g);
    setStep(2);
  };

  const handleNationalitySelect = (n: string) => {
    setNationality(n);
    setStep(3);
  };

  const handleComplete = async () => {
    if (!gender || !nationality || !voiceId) return;
    stopPreview();
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
    stopPreview();
    if (step === 2) { setStep(1); setNationality(null); }
    if (step === 3) setStep(2);
  };

  const filteredProfiles = profiles.filter((p) => p.gender === gender);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg animate-slide-up overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="gradient-bg relative px-6 py-5">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 p-1 text-white/60 transition-colors hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
          <h2 className="text-xl font-bold text-white">Customize your tutor</h2>
          <p className="mt-1 text-sm text-blue-200">
            {step === 1 && "Choose your tutor's gender"}
            {step === 2 && "Choose your tutor's nationality"}
            {step === 3 && "Choose your tutor's voice"}
          </p>
          <div className="mt-3 flex gap-1.5">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? "bg-white" : "bg-white/30"}`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Gender */}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-3">
              {(["male", "female"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => { handleGenderSelect(g); }}
                  className={`rounded-2xl border-2 p-5 transition-all duration-200 hover:shadow-md ${
                    gender === g
                      ? "border-primary-500 bg-primary-50"
                      : "border-gray-100 hover:border-primary-200"
                  }`}
                >
                  <div className="mb-2 text-3xl">{g === "male" ? "\uD83D\uDC68\u200D\uD83C\uDFEB" : "\uD83D\uDC69\u200D\uD83C\uDFEB"}</div>
                  <p className="font-semibold capitalize text-gray-800">{g}</p>
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
                    className={`w-full rounded-2xl border-2 p-4 text-left transition-all duration-200 hover:shadow-md ${
                      nationality === p.nationality
                        ? "border-primary-500 bg-primary-50"
                        : "border-gray-100 hover:border-primary-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{nat?.flag}</span>
                      <div>
                        <p className="font-semibold text-gray-800">{nat?.label}</p>
                        <p className="mt-0.5 text-sm text-gray-500">{p.description}</p>
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
                <div
                  key={v.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 transition-all duration-200 hover:shadow-md ${
                    voiceId === v.id
                      ? "border-primary-500 bg-primary-50"
                      : "border-gray-100 hover:border-primary-200"
                  }`}
                  onClick={() => { setVoiceId(v.id); }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePreview(v);
                    }}
                    className={`flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                      playingVoiceId === v.id
                        ? "bg-primary-500 text-white"
                        : voiceId === v.id
                          ? "bg-primary-500 text-white"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {playingVoiceId === v.id ? (
                      <svg className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                      </svg>
                    ) : (
                      <svg className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                      </svg>
                    )}
                  </button>
                  <p className="font-semibold text-gray-800">{v.name}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6">
          {step > 1 && (
            <button
              type="button"
              onClick={handleBack}
              className="rounded-xl border border-gray-200 px-5 py-2.5 font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              Back
            </button>
          )}
          {step === 3 && (
            <button
              type="button"
              onClick={() => { void handleComplete(); }}
              disabled={saving || !voiceId}
              className="gradient-bg flex-1 rounded-xl px-5 py-2.5 font-medium text-white transition-all hover:shadow-lg disabled:opacity-50"
            >
              {saving ? "Saving..." : "Start learning"}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
