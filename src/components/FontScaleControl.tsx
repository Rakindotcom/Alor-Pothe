"use client";

import { useEffect, useState } from "react";

type FontScale = "normal" | "large" | "xlarge";

const STORAGE_KEY = "alor_pothe_font_scale";

const SCALE_LABELS: Record<FontScale, string> = {
  normal: "অ+ লেখা বড়",
  large: "অ++ আরও বড়",
  xlarge: "অ স্বাভাবিক আকার",
};

export function FontScaleControl() {
  const [scale, setScale] = useState<FontScale>("normal");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) as FontScale | null;
      if (saved === "normal" || saved === "large" || saved === "xlarge") {
        setScale(saved);
        document.documentElement.setAttribute("data-font-scale", saved);
      }
    } catch {
      // Ignore storage access issues in private browsing
    }
  }, []);

  const cycleScale = () => {
    const next: FontScale =
      scale === "normal" ? "large" : scale === "large" ? "xlarge" : "normal";
    setScale(next);
    document.documentElement.setAttribute("data-font-scale", next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage errors
    }
  };

  return (
    <button
      type="button"
      onClick={cycleScale}
      aria-label="লেখার আকার পরিবর্তন করুন"
      className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#14532D]/25 bg-white px-4 py-2 text-base font-bold text-[#14532D] shadow-xs transition active:scale-95 hover:border-[#14532D] hover:bg-[#DCFCE7]/50 min-h-[44px]"
    >
      <span>{SCALE_LABELS[scale]}</span>
    </button>
  );
}
