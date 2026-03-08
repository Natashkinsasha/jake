"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { VocabularyStats } from "@/types";

function ProgressRing({ percent, size = 64, strokeWidth = 5 }: { percent: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-gray-100"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="url(#vocab-ring-gradient)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-1000 ease-out"
      />
      <defs>
        <linearGradient id="vocab-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function VocabularyWidget() {
  const router = useRouter();
  const [stats, setStats] = useState<VocabularyStats | null>(null);

  useEffect(() => {
    void api.vocabulary.stats().then(setStats).catch(() => {});
  }, []);

  if (!stats || stats.total === 0) return null;

  const learnedPercent = stats.total > 0 ? Math.round((stats.learned / stats.total) * 100) : 0;

  return (
    <button
      type="button"
      onClick={() => { router.push("/vocabulary"); }}
      className="w-full text-left group bg-white rounded-2xl border border-gray-100 p-5 hover:border-primary-200 hover:shadow-lg hover:shadow-primary-900/5 transition-all duration-300"
    >
      <div className="flex items-start gap-5">
        {/* Progress ring */}
        <div className="relative flex-shrink-0">
          <ProgressRing percent={learnedPercent} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold text-gray-900">{learnedPercent}%</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">Vocabulary</h3>
            <svg className="w-4 h-4 text-gray-300 group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>

          <div className="flex gap-4">
            <div>
              <p className="text-xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-[11px] text-gray-400 uppercase tracking-wider">words</p>
            </div>
            <div className="w-px bg-gray-100" />
            <div>
              <p className="text-xl font-bold text-emerald-600">{stats.learned}</p>
              <p className="text-[11px] text-gray-400 uppercase tracking-wider">learned</p>
            </div>
            <div className="w-px bg-gray-100" />
            <div>
              <p className="text-xl font-bold text-amber-500">{stats.new + stats.learning}</p>
              <p className="text-[11px] text-gray-400 uppercase tracking-wider">active</p>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
