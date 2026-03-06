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
    void api.auth.me().then((res) => {
      setPrefs(res.user_preferences ?? {});
    });
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-4 z-50 flex items-start justify-center pt-12">
        <div className="bg-gray-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h2 className="text-sm font-mono text-white/80">Debug Info</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-white/40 hover:text-white/80 text-sm"
            >
              Close
            </button>
          </div>
          <div className="p-4 space-y-4 text-xs font-mono">
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
                <pre className="text-green-400 whitespace-pre-wrap break-words text-[11px] leading-relaxed max-h-[40vh] overflow-y-auto">
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
      <h3 className="text-white/50 uppercase tracking-wider mb-2">{title}</h3>
      <div className="space-y-1 bg-white/5 rounded-lg p-3">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-white/40 shrink-0">{label}</span>
      <span className="text-green-400 text-right break-all">
        {value === undefined ? <span className="text-white/20">undefined</span> : String(value)}
      </span>
    </div>
  );
}
