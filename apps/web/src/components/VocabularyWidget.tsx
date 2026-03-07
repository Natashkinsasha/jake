"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { VocabularyStats } from "@/types";

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
      className="w-full text-left group bg-white rounded-2xl border border-gray-100 p-5 hover:border-primary-200 hover:shadow-md hover:shadow-primary-900/5 transition-all duration-200"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Vocabulary</h3>
        <svg className="w-4 h-4 text-gray-300 group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-400 mt-0.5">Total</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-emerald-600">{stats.learned}</p>
          <p className="text-xs text-gray-400 mt-0.5">Learned</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-amber-500">{stats.new + stats.learning}</p>
          <p className="text-xs text-gray-400 mt-0.5">In progress</p>
        </div>
      </div>

      <div className="w-full bg-gray-100 rounded-full h-2">
        <div
          className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
          style={{ width: `${learnedPercent}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1.5 text-right">{learnedPercent}% learned</p>
    </button>
  );
}
