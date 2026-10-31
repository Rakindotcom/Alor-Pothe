"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Award, Calendar, Clock, Hash, Layers, X } from "lucide-react";
import { clientDb } from "@/lib/firebase-client";
import {
  formatDhakaTimeBangla,
  formatNumber,
  formatSubmissionDayBangla,
} from "@/lib/timezone";
import type { LeaderboardEntry, ZikrSubmissionDoc } from "@/lib/types";

interface MemberDetailModalProps {
  member: LeaderboardEntry | null;
  todayDhakaDate: string;
  onClose: () => void;
}

export function MemberDetailModal({
  member,
  todayDhakaDate,
  onClose,
}: MemberDetailModalProps) {
  const [submissions, setSubmissions] = useState<ZikrSubmissionDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!member) return;

    setLoading(true);
    // Single-field where query avoids composite-index delays; sorted in memory
    const q = query(
      collection(clientDb, "zikr_submissions"),
      where("member_id", "==", member.id)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs
          .map((d) => d.data() as ZikrSubmissionDoc)
          .filter((d) => d.status !== "reversed")
          .sort((a, b) => b.submitted_at_ms - a.submitted_at_ms);

        setSubmissions(docs);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load member submissions:", err);
        setLoading(false);
      }
    );

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      unsubscribe();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [member, onClose]);

  if (!member) return null;

  const totalSubmissionsCount = loading
    ? member.submission_count
    : submissions.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-[2px] p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="member-detail-heading"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-[#FAF9F6] shadow-2xl border border-[#E5E2DC] max-h-[90dvh] flex flex-col overflow-hidden animate-gentle-in">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#14532D] to-[#0E3B1F] px-6 py-5 text-white flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1 text-base font-semibold text-[#DCFCE7] mb-2">
              <Award className="h-4 w-4 text-[#C5A46D]" />
              পারিবারিক অবস্থান: #{member.all_time_rank}
            </span>
            <h3
              id="member-detail-heading"
              className="text-2xl sm:text-3xl font-extrabold leading-tight"
            >
              {member.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="বিস্তারিত তথ্য বন্ধ করুন"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition"
          >
            <X className="h-7 w-7" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-5 flex-1">
          {/* 4 Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-3.5">
            <div className="rounded-2xl border-2 border-[#14532D]/20 bg-white p-4 shadow-xs">
              <div className="flex items-center gap-2 text-base font-semibold text-[#4B5563]">
                <Layers className="h-5 w-5 text-[#14532D]" />
                <span>সর্বমোট যিকির</span>
              </div>
              <div className="mt-1.5 text-2xl sm:text-3xl font-extrabold tabular-nums text-[#14532D]">
                {formatNumber(member.lifetime_zikr)}
              </div>
            </div>

            <div className="rounded-2xl border-2 border-[#C5A46D]/40 bg-[#FBF6EC] p-4 shadow-xs">
              <div className="flex items-center gap-2 text-base font-semibold text-[#4B5563]">
                <Calendar className="h-5 w-5 text-[#9A7432]" />
                <span>আজকের যিকির</span>
              </div>
              <div className="mt-1.5 text-2xl sm:text-3xl font-extrabold tabular-nums text-[#1F2937]">
                {formatNumber(member.today_zikr)}
              </div>
            </div>

            <div className="rounded-2xl border border-[#E5E2DC] bg-white p-4 shadow-xs">
              <div className="flex items-center gap-2 text-base font-semibold text-[#4B5563]">
                <Award className="h-5 w-5 text-[#C5A46D]" />
                <span>বর্তমান র‍্যাংক</span>
              </div>
              <div className="mt-1 text-2xl font-extrabold tabular-nums text-[#1F2937]">
                #{member.all_time_rank}
              </div>
            </div>

            <div className="rounded-2xl border border-[#E5E2DC] bg-white p-4 shadow-xs">
              <div className="flex items-center gap-2 text-base font-semibold text-[#4B5563]">
                <Hash className="h-5 w-5 text-[#14532D]" />
                <span>মোট সাবমিশন</span>
              </div>
              <div className="mt-1 text-2xl font-extrabold tabular-nums text-[#1F2937]">
                {formatNumber(totalSubmissionsCount)} বার
              </div>
            </div>
          </div>

          {/* Recent Submission History */}
          <div className="rounded-2xl border border-[#E5E2DC] bg-white p-4 sm:p-5 shadow-xs">
            <h4 className="text-xl font-bold text-[#14532D] mb-3 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              <span>সাম্প্রতিক যিকিরের হিসাব</span>
            </h4>

            {loading ? (
              <div className="py-8 text-center text-lg text-[#4B5563]">
                তথ্য লোড হচ্ছে...
              </div>
            ) : submissions.length === 0 ? (
              <div className="py-8 text-center text-lg text-[#4B5563] bg-[#FAF9F6] rounded-xl px-4">
                এখনো কোনো যিকির যুক্ত করা হয়নি।
              </div>
            ) : (
              <ul className="divide-y divide-[#E5E2DC]">
                {submissions.slice(0, 15).map((sub) => (
                  <li
                    key={sub.id}
                    className="py-3.5 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-lg sm:text-xl font-bold text-[#1F2937]">
                        {formatSubmissionDayBangla(sub.dhaka_date, todayDhakaDate)}
                      </div>
                      <div className="text-base text-[#4B5563] flex items-center gap-2">
                        <span>{formatDhakaTimeBangla(sub.submitted_at_ms)}</span>
                        {sub.status === "corrected" && (
                          <span className="rounded-full bg-[#FBF6EC] border border-[#C5A46D]/50 px-2.5 py-0.5 text-sm font-semibold text-[#855E1E]">
                            সংশোধিত
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-xl sm:text-2xl font-extrabold tabular-nums text-[#14532D] bg-[#DCFCE7]/70 px-3.5 py-1.5 rounded-xl">
                      +{formatNumber(sub.zikr_count)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Footer Close Button */}
        <div className="p-4 bg-white border-t border-[#E5E2DC]">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[58px] rounded-2xl bg-[#14532D] text-xl font-bold text-white hover:bg-[#0E3B1F] active:scale-[0.99] transition shadow-sm"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
}
