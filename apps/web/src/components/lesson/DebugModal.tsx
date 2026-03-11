"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { UserPreferences } from "@/types";

interface DebugModalProps {
  open: boolean;
  onClose: () => void;
  debugInfo: {
    voiceId: string | null;
    speechSpeed: number;
    ttsModel: string | undefined;
    systemPrompt: string | null;
  };
}

export function DebugModal({ open, onClose, debugInfo }: DebugModalProps) {
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);

  useEffect(() => {
    if (!open) return;
    void api.auth
      .me()
      .then((res) => {
        setPrefs(res.user_preferences ?? {});
      })
      .catch(() => {});
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="fixed inset-4 z-50 flex items-start justify-center pt-12">
        <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-xl border border-white/10 bg-gray-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <h2 className="font-mono text-sm text-white/80">Debug Info</h2>
            <button type="button" onClick={onClose} className="text-sm text-white/40 hover:text-white/80">
              Close
            </button>
          </div>
          <div className="space-y-4 p-4 font-mono text-xs">
            <Section title="Session">
              <Row label="voiceId" value={debugInfo.voiceId} />
              <Row label="speechSpeed" value={debugInfo.speechSpeed} />
              <Row label="ttsModel" value={debugInfo.ttsModel} />
            </Section>

            <Section title="User Preferences">
              {prefs ? (
                <>
                  <Row label="ttsModel" value={prefs.ttsModel} />
                  <Row label="speakingSpeed" value={prefs.speakingSpeed} />
                  <Row label="correctionStyle" value={prefs.correctionStyle} />
                  <Row label="explainGrammar" value={prefs.explainGrammar} />
                  <Row label="useNativeLanguage" value={prefs.useNativeLanguage} />
                </>
              ) : (
                <span className="text-white/30">Loading...</span>
              )}
            </Section>

            <Section title="System Prompt">
              {debugInfo.systemPrompt ? (
                <pre className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-green-400">
                  {debugInfo.systemPrompt}
                </pre>
              ) : (
                <span className="text-white/30">Not available</span>
              )}
            </Section>
          </div>
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 uppercase tracking-wider text-white/50">{title}</h3>
      <div className="space-y-1 rounded-lg bg-white/5 p-3">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="shrink-0 text-white/40">{label}</span>
      <span className="break-all text-right text-green-400">
        {value === undefined ? <span className="text-white/20">undefined</span> : String(value)}
      </span>
    </div>
  );
}
