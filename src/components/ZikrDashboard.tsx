"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Lock,
  PlusCircle,
  ShieldCheck,
  Sparkles,
  Users,
  WifiOff,
  X,
} from "lucide-react";
import { clientDb } from "@/lib/firebase-client";
import { computeLeaderboardStats } from "@/lib/leaderboard";
import { isValidMemberId } from "@/lib/members";
import {
  formatFullDhakaDateBangla,
  formatNumber,
  getDhakaDateString,
} from "@/lib/timezone";
import type {
  FamilyMemberDoc,
  LeaderboardEntry,
  LeaderboardPeriod,
  SubmitZikrResponse,
  ZikrSubmissionDoc,
} from "@/lib/types";
import { validateZikrCount } from "@/lib/validation";
import { useAnimatedNumber, useFlipReorder } from "./animations";
import { FontScaleControl } from "./FontScaleControl";
import { MemberDetailModal } from "./MemberDetailModal";
import { MemberSelectModal } from "./MemberSelectModal";

const LAST_MEMBER_STORAGE_KEY = "alor_pothe_selected_member";
const FAMILY_CODE_STORAGE_KEY = "alor_pothe_family_code";
const REQUIRE_FAMILY_CODE =
  process.env.NEXT_PUBLIC_REQUIRE_FAMILY_CODE === "true";

function generateSubmissionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `sub_${crypto.randomUUID().replace(/-/g, "")}`;
  }
  return `sub_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
}

export function ZikrDashboard() {
  // Real-time Firestore state
  const [memberDocs, setMemberDocs] = useState<FamilyMemberDoc[]>([]);
  const [todaySubmissions, setTodaySubmissions] = useState<ZikrSubmissionDoc[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [syncConnected, setSyncConnected] = useState(true);
  const [isOnline, setIsOnline] = useState(true);

  // Dhaka date (auto-updates across midnight Asia/Dhaka)
  const [todayDhakaDate, setTodayDhakaDate] = useState<string>(() =>
    getDhakaDateString()
  );

  // Leaderboard time-period toggle ("all-time" default per specification)
  const [period, setPeriod] = useState<LeaderboardPeriod>("all-time");

  // Form state
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [countInput, setCountInput] = useState<string>("");
  const [familyCode, setFamilyCode] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successReceipt, setSuccessReceipt] = useState<SubmitZikrResponse | null>(
    null
  );

  // Detail modal state
  const [activeDetailMemberId, setActiveDetailMemberId] = useState<string | null>(
    null
  );

  // Synchronous lock + stable idempotency token for safe retries
  const submittingLockRef = useRef(false);
  const pendingSubmissionIdRef = useRef<string>(generateSubmissionId());
  const initTriggeredRef = useRef(false);

  // Restore last selected family member & family code from device storage (convenience only)
  useEffect(() => {
    try {
      const savedMember = window.localStorage.getItem(LAST_MEMBER_STORAGE_KEY);
      if (savedMember && isValidMemberId(savedMember)) {
        setSelectedMemberId(savedMember);
      }
      if (REQUIRE_FAMILY_CODE) {
        const savedCode = window.localStorage.getItem(FAMILY_CODE_STORAGE_KEY);
        if (savedCode) setFamilyCode(savedCode);
      }
    } catch {
      // Ignore storage access errors
    }
  }, []);

  // Track browser online/offline state accurately
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Watch Asia/Dhaka date so midnight rollover happens automatically without refresh
  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = getDhakaDateString();
      setTodayDhakaDate((prev) => (prev !== current ? current : prev));
    }, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  // Ensure all 12 members are initialized in Firestore
  const triggerServerInit = useCallback(async () => {
    if (initTriggeredRef.current) return;
    initTriggeredRef.current = true;
    try {
      await fetch("/api/init", { method: "POST" });
    } catch {
      initTriggeredRef.current = false;
    }
  }, []);

  // 1. Real-time subscription to `family_members`
  useEffect(() => {
    const membersCol = collection(clientDb, "family_members");
    const unsubscribe = onSnapshot(
      membersCol,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => d.data() as FamilyMemberDoc);
        setMemberDocs(docs);
        setIsLoadingData(false);
        setSyncConnected(true);

        if (snapshot.size < 12) {
          void triggerServerInit();
        }
      },
      (err) => {
        console.error("Realtime family_members listener error:", err);
        setSyncConnected(false);
        setIsLoadingData(false);
      }
    );

    return () => unsubscribe();
  }, [triggerServerInit]);

  // 2. Real-time subscription to Today's submissions (Asia/Dhaka date)
  useEffect(() => {
    const todayQuery = query(
      collection(clientDb, "zikr_submissions"),
      where("dhaka_date", "==", todayDhakaDate)
    );

    const unsubscribe = onSnapshot(
      todayQuery,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => d.data() as ZikrSubmissionDoc);
        setTodaySubmissions(docs);
      },
      (err) => {
        console.error("Realtime today submissions listener error:", err);
      }
    );

    return () => unsubscribe();
  }, [todayDhakaDate]);

  // Derived leaderboard & family totals
  const stats = useMemo(
    () => computeLeaderboardStats(memberDocs, todaySubmissions, period),
    [memberDocs, todaySubmissions, period]
  );

  // Subtle count-up for the family total & smooth row gliding on rank changes
  const animatedFamilyTotal = useAnimatedNumber(stats.activeTotalForPeriod);
  const leaderboardOrderKey = stats.entries.map((e) => e.id).join("|");
  const flipRef = useFlipReorder(leaderboardOrderKey);

  const activeDetailMember: LeaderboardEntry | null = useMemo(
    () =>
      activeDetailMemberId
        ? stats.entriesById[activeDetailMemberId] ?? null
        : null,
    [activeDetailMemberId, stats.entriesById]
  );

  // Live preview of count addition before submitting
  const parsedPreview = useMemo(() => {
    if (!countInput.trim()) return null;
    const res = validateZikrCount(countInput);
    return res.valid ? res.value : null;
  }, [countInput]);

  const selectedMemberEntry = selectedMemberId
    ? stats.entriesById[selectedMemberId]
    : undefined;

  const handleSelectMember = (memberId: string) => {
    setSelectedMemberId(memberId);
    setFormError(null);
    pendingSubmissionIdRef.current = generateSubmissionId();
    try {
      window.localStorage.setItem(LAST_MEMBER_STORAGE_KEY, memberId);
    } catch {
      // Ignore storage errors
    }
  };

  const handleCountInputChange = (rawVal: string) => {
    setCountInput(rawVal);
    setFormError(null);
    if (successReceipt) setSuccessReceipt(null);
    pendingSubmissionIdRef.current = generateSubmissionId();
  };

  const handleQuickAddChip = (amount: number) => {
    setFormError(null);
    if (successReceipt) setSuccessReceipt(null);
    const currentCheck = validateZikrCount(countInput);
    const currentVal = currentCheck.valid ? currentCheck.value : 0;
    const nextVal = Math.min(1_000_000, currentVal + amount);
    setCountInput(String(nextVal));
    pendingSubmissionIdRef.current = generateSubmissionId();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submittingLockRef.current || isSubmitting) {
      return;
    }

    setFormError(null);

    if (!isOnline) {
      setFormError(
        "আপনার ইন্টারনেট সংযোগ বিচ্ছিন্ন রয়েছে। অনুগ্রহ করে ইন্টারনেট চালু করে আবার চেষ্টা করুন।"
      );
      return;
    }

    if (!selectedMemberId || !isValidMemberId(selectedMemberId)) {
      setFormError("অনুগ্রহ করে প্রথমে আপনার নাম নির্বাচন করুন।");
      return;
    }

    const validation = validateZikrCount(countInput);
    if (!validation.valid) {
      setFormError(validation.error);
      return;
    }

    if (REQUIRE_FAMILY_CODE && !familyCode.trim()) {
      setFormError("অনুগ্রহ করে পারিবারিক অ্যাক্সেস কোডটি লিখুন।");
      return;
    }

    submittingLockRef.current = true;
    setIsSubmitting(true);

    const submissionId = pendingSubmissionIdRef.current;

    try {
      const response = await fetch("/api/zikr/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          memberId: selectedMemberId,
          zikrCount: validation.value,
          submissionId,
          familyCode: REQUIRE_FAMILY_CODE ? familyCode.trim() : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setFormError(
          data.error ||
            "যিকির যুক্ত করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।"
        );
        return;
      }

      if (REQUIRE_FAMILY_CODE && familyCode.trim()) {
        try {
          window.localStorage.setItem(
            FAMILY_CODE_STORAGE_KEY,
            familyCode.trim()
          );
        } catch {
          // Ignore storage errors
        }
      }

      const receipt = data as SubmitZikrResponse;
      setSuccessReceipt(receipt);
      // Clear numeric input while keeping the selected family member!
      setCountInput("");
      // Rotate submission ID ONLY after confirmed save
      pendingSubmissionIdRef.current = generateSubmissionId();
    } catch {
      // Keep the same pendingSubmissionIdRef so retrying is 100% idempotent!
      setFormError(
        "ইন্টারনেট সংযোগে সাময়িক সমস্যা হয়েছে। আপনার সংখ্যাটি মুছে যায়নি — ইন্টারনেট ঠিক হলে আবার বাটনে চাপ দিন।"
      );
    } finally {
      submittingLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#FAF9F6] text-[#1F2937] flex flex-col">
      {/* Offline Warning Banner */}
      {!isOnline && (
        <div
          role="alert"
          className="sticky top-0 z-40 bg-[#92400E] text-white px-4 py-3.5 shadow-md"
        >
          <div className="mx-auto max-w-xl flex items-center gap-3 text-lg font-bold">
            <WifiOff className="h-6 w-6 shrink-0" />
            <span>
              ইন্টারনেট সংযোগ বিচ্ছিন্ন। সংযোগ ফিরে এলে আপনার যিকির সংরক্ষণ করুন।
            </span>
          </div>
        </div>
      )}

      {/* Main Centered Mobile-First Container */}
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pt-5 pb-12 sm:px-6 space-y-6">
        {/* Top Accessibility & Live Status Utility Bar */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="inline-flex items-center gap-2 rounded-full bg-white border border-[#E5E2DC] px-3.5 py-1.5 text-base font-semibold text-[#374151] shadow-2xs">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isOnline && syncConnected
                  ? "bg-[#16A34A] animate-pulse"
                  : "bg-[#D97706]"
              }`}
            />
            <span>
              {isOnline && syncConnected ? "সরাসরি সংযুক্ত" : "সংযোগ পরীক্ষা হচ্ছে"}
            </span>
          </div>

          <FontScaleControl />
        </div>

        {/* 1. Header */}
        <header className="text-center pt-1 pb-1">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#14532D] text-[#C5A46D] shadow-md border-2 border-[#C5A46D]/40">
            <svg
              width="36"
              height="36"
              viewBox="0 0 100 100"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M62 18A33 33 0 1 0 84 71A27 27 0 1 1 62 18Z"
                fill="#C5A46D"
              />
              <polygon
                points="70,29 73,38 82,38 75,43 77,52 70,47 63,52 65,43 58,38 67,38"
                fill="#DCFCE7"
              />
            </svg>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[#14532D] leading-tight">
            আলোর পথে
          </h1>
          <p className="mt-1.5 text-xl sm:text-2xl font-medium text-[#4B5563]">
            “আল্লাহর স্মরণে আমরা সবাই একসাথে”
          </p>
        </header>

        {/* 2. Family Total Zikr Hero Card */}
        <section
          aria-label="পরিবারের মোট যিকিরের হিসাব"
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#14532D] via-[#114827] to-[#0C351C] p-6 sm:p-8 text-white shadow-lg border-2 border-[#C5A46D]/45"
        >
          {/* Subtle Islamic Geometric Star Watermark */}
          <svg
            className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 text-[#C5A46D] opacity-10"
            viewBox="0 0 100 100"
            fill="currentColor"
            aria-hidden="true"
          >
            <polygon points="50,2 61,22 84,16 78,39 98,50 78,61 84,84 61,78 50,98 39,78 16,84 22,61 2,50 22,39 16,16 39,22" />
          </svg>

          <div className="relative z-10 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/12 border border-[#C5A46D]/40 px-4 py-1 text-base sm:text-lg font-semibold text-[#DCFCE7]">
              <Sparkles className="h-4 w-4 text-[#C5A46D]" />
              <span>
                {period === "today"
                  ? "আজকের পারিবারিক মোট যিকির"
                  : "পরিবারের সর্বমোট যিকির"}
              </span>
            </div>

            <div className="mt-4 mb-4 text-5xl sm:text-6xl font-extrabold tracking-tight tabular-nums text-white drop-shadow-xs">
              {isLoadingData ? "..." : formatNumber(animatedFamilyTotal)}
            </div>

            <div className="mt-4 pt-4 border-t border-white/15 flex flex-wrap items-center justify-center gap-3 sm:gap-5 text-lg font-semibold text-[#DCFCE7]">
              <span className="inline-flex items-center gap-2">
                <Users className="h-5 w-5 text-[#C5A46D]" />
                <span>12 জন পারিবারিক সদস্য</span>
              </span>
              <span className="text-white/30">•</span>
              <span>
                {period === "today" ? (
                  <>
                    সর্বমোট:{" "}
                    <strong className="text-white tabular-nums">
                      {formatNumber(stats.familyAllTimeTotal)}
                    </strong>
                  </>
                ) : (
                  <>
                    আজকের মোট:{" "}
                    <strong className="text-white tabular-nums">
                      {formatNumber(stats.familyTodayTotal)}
                    </strong>
                  </>
                )}
              </span>
            </div>
          </div>
        </section>

        {/* 3. Add Your Zikr Card */}
        <section
          aria-labelledby="add-zikr-heading"
          className="rounded-3xl border-2 border-[#E5E2DC] bg-white p-5 sm:p-7 shadow-sm"
        >
          <div className="mb-5">
            <h2
              id="add-zikr-heading"
              className="text-2xl sm:text-[26px] font-extrabold text-[#14532D] flex items-center gap-2.5"
            >
              <PlusCircle className="h-7 w-7 text-[#14532D] shrink-0" />
              <span>আপনার যিকির যুক্ত করুন</span>
            </h2>
            <p className="mt-1 text-lg text-[#4B5563]">
              আপনার নাম বেছে নিয়ে কতবার যিকির করেছেন তা লিখুন
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Step 1: Select Family Member */}
            <div>
              <label className="block text-xl font-bold text-[#1F2937] mb-2">
                ১. আপনার নাম নির্বাচন করুন
              </label>
              <MemberSelectModal
                selectedMemberId={selectedMemberId}
                onSelect={handleSelectMember}
                entriesById={stats.entriesById}
                disabled={isSubmitting}
              />
            </div>

            {/* Step 2: Enter Zikr Count */}
            <div>
              <label
                htmlFor="zikr-count-input"
                className="block text-xl font-bold text-[#1F2937] mb-2"
              >
                ২. যিকিরের সংখ্যা লিখুন
              </label>

              <div className="relative">
                <input
                  id="zikr-count-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9০-৯,]*"
                  autoComplete="off"
                  disabled={isSubmitting}
                  value={countInput}
                  onChange={(e) => handleCountInputChange(e.target.value)}
                  placeholder="যেমন: 100 বা 1000"
                  className="w-full min-h-[70px] rounded-2xl border-2 border-[#C7C3B8] bg-[#FAF9F6] px-5 pr-14 py-4 text-3xl font-extrabold tabular-nums text-[#1F2937] placeholder:text-xl placeholder:font-medium placeholder:text-[#6B7280] focus:border-[#14532D] focus:bg-white transition"
                />
                {countInput && !isSubmitting && (
                  <button
                    type="button"
                    onClick={() => handleCountInputChange("")}
                    aria-label="সংখ্যা মুছে ফেলুন"
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-[#E5E2DC]/80 text-[#374151] hover:bg-[#D5D1C8] transition"
                  >
                    <X className="h-6 w-6" />
                  </button>
                )}
              </div>

              {/* Helpful Quick-Add Buttons for Elderly Convenience */}
              <div className="mt-3">
                <span className="block text-base font-semibold text-[#4B5563] mb-2">
                  দ্রুত সংখ্যা যোগ করতে নিচের বাটনে চাপ দিতে পারেন:
                </span>
                <div className="grid grid-cols-2 min-[400px]:grid-cols-4 gap-2">
                  {[100, 300, 500, 1000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleQuickAddChip(preset)}
                      className="min-h-[52px] rounded-xl border-2 border-[#14532D]/25 bg-[#DCFCE7]/45 px-2 py-2.5 text-lg sm:text-xl font-bold tabular-nums text-[#14532D] hover:bg-[#DCFCE7] active:scale-95 transition"
                    >
                      +{formatNumber(preset)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reassuring Cumulative Addition Preview */}
              {selectedMemberEntry && parsedPreview !== null && (
                <div className="mt-3.5 rounded-2xl bg-[#FAF9F6] border border-[#14532D]/25 px-4 py-3 text-lg text-[#1F2937]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      আগের মোট:{" "}
                      <strong className="tabular-nums">
                        {formatNumber(selectedMemberEntry.lifetime_zikr)}
                      </strong>
                    </span>
                    <span>+</span>
                    <span className="text-[#14532D]">
                      নতুন:{" "}
                      <strong className="tabular-nums">
                        {formatNumber(parsedPreview)}
                      </strong>
                    </span>
                    <span>=</span>
                    <span className="font-bold text-[#14532D]">
                      মোট হবে:{" "}
                      <strong className="tabular-nums">
                        {formatNumber(
                          selectedMemberEntry.lifetime_zikr + parsedPreview
                        )}
                      </strong>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Optional Shared Family Access Code (only shown if enabled in env) */}
            {REQUIRE_FAMILY_CODE && (
              <div>
                <label
                  htmlFor="family-access-code"
                  className="block text-xl font-bold text-[#1F2937] mb-2"
                >
                  পারিবারিক কোড
                </label>
                <input
                  id="family-access-code"
                  type="password"
                  value={familyCode}
                  onChange={(e) => setFamilyCode(e.target.value)}
                  placeholder="পারিবারিক কোড লিখুন"
                  className="w-full min-h-[60px] rounded-2xl border-2 border-[#C7C3B8] bg-[#FAF9F6] px-5 py-3.5 text-2xl font-bold text-[#1F2937] focus:border-[#14532D] focus:bg-white"
                />
              </div>
            )}

            {/* Validation / Network Error Alert */}
            {formError && (
              <div
                role="alert"
                className="rounded-2xl border-2 border-[#DC2626]/40 bg-[#FEF2F2] p-4 flex items-start gap-3 text-[#991B1B] animate-gentle-in"
              >
                <AlertCircle className="h-7 w-7 shrink-0 mt-0.5 text-[#DC2626]" />
                <div className="text-lg sm:text-xl font-bold leading-snug">
                  {formError}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !isOnline}
              className="w-full min-h-[68px] rounded-2xl bg-[#14532D] px-6 py-4 text-2xl font-extrabold text-white shadow-md transition hover:bg-[#0E3B1F] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {isSubmitting ? (
                <>
                  <span className="h-6 w-6 rounded-full border-3 border-white border-t-transparent animate-spin" />
                  <span>সংরক্ষণ হচ্ছে...</span>
                </>
              ) : (
                <span>যিকির যুক্ত করুন</span>
              )}
            </button>
          </form>

          {/* Alhamdulillah Success Confirmation Card */}
          {successReceipt && (
            <div
              role="status"
              aria-live="polite"
              className="mt-5 rounded-2xl border-2 border-[#15803D] bg-[#DCFCE7] p-5 text-[#14532D] shadow-xs animate-gentle-in"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-8 w-8 shrink-0 text-[#15803D] mt-0.5" />
                  <div>
                    <p className="text-xl sm:text-2xl font-extrabold leading-snug">
                      আলহামদুলিল্লাহ! {formatNumber(successReceipt.addedCount)}{" "}
                      যিকির সফলভাবে যুক্ত হয়েছে।
                    </p>
                    <div className="mt-3 rounded-xl bg-white/85 p-3.5 text-lg font-semibold text-[#1F2937] space-y-1">
                      <div>
                        সদস্য:{" "}
                        <strong className="text-[#14532D]">
                          {successReceipt.memberName}
                        </strong>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
                        <span>
                          আগের মোট:{" "}
                          <strong>
                            {formatNumber(successReceipt.previousTotal)}
                          </strong>
                        </span>
                        <span>
                          নতুন জমা:{" "}
                          <strong className="text-[#15803D]">
                            +{formatNumber(successReceipt.addedCount)}
                          </strong>
                        </span>
                        <span>
                          বর্তমান মোট:{" "}
                          <strong className="text-[#14532D]">
                            {formatNumber(successReceipt.updatedTotal)}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSuccessReceipt(null)}
                  aria-label="বার্তা বন্ধ করুন"
                  className="p-1.5 rounded-lg text-[#14532D]/70 hover:bg-[#14532D]/10"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
          )}
        </section>

        {/* 4. Live Leaderboard Section */}
        <section
          aria-labelledby="leaderboard-heading"
          className="rounded-3xl border-2 border-[#E5E2DC] bg-white p-5 sm:p-7 shadow-sm"
        >
          <div className="flex flex-col gap-4 mb-5">
            <div>
              <h2
                id="leaderboard-heading"
                className="text-2xl sm:text-[26px] font-extrabold text-[#14532D]"
              >
                পারিবারিক লিডারবোর্ড
              </h2>
              <p className="mt-1 text-lg text-[#4B5563]">
                যেকোনো সদস্যের নামের ওপর চাপ দিয়ে বিস্তারিত পরিসংখ্যান দেখুন
              </p>
            </div>

            {/* Today / All-Time Segmented Toggle (All-Time is default) */}
            <div
              role="tablist"
              aria-label="সময়ের হিসাব নির্বাচন"
              className="grid grid-cols-2 gap-2 rounded-2xl bg-[#F2EFE9] p-1.5 border border-[#E5E2DC]"
            >
              <button
                type="button"
                role="tab"
                aria-selected={period === "all-time"}
                onClick={() => setPeriod("all-time")}
                className={`min-h-[54px] rounded-xl px-4 py-2.5 text-xl font-bold transition ${
                  period === "all-time"
                    ? "bg-[#14532D] text-white shadow-sm"
                    : "text-[#374151] hover:bg-white/60"
                }`}
              >
                সর্বমোট হিসাব
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={period === "today"}
                onClick={() => setPeriod("today")}
                className={`min-h-[54px] rounded-xl px-4 py-2.5 text-xl font-bold transition ${
                  period === "today"
                    ? "bg-[#14532D] text-white shadow-sm"
                    : "text-[#374151] hover:bg-white/60"
                }`}
              >
                আজকের হিসাব
              </button>
            </div>

            {period === "today" && (
              <div className="rounded-xl bg-[#FBF6EC] border border-[#C5A46D]/45 px-4 py-2.5 text-base sm:text-lg font-semibold text-[#78531A] text-center">
                আজকের তারিখ (বাংলাদেশ সময়):{" "}
                <strong>{formatFullDhakaDateBangla(todayDhakaDate)}</strong>
              </div>
            )}
          </div>

          {/* All 12 Ranked Family Members */}
          <div className="space-y-3">
            {stats.entries.map((entry) => {
              const hasPositiveZikr = entry.zikr_count > 0;
              const isGold = entry.rank === 1 && hasPositiveZikr;
              const isSilver = entry.rank === 2 && hasPositiveZikr;
              const isBronze = entry.rank === 3 && hasPositiveZikr;

              let rowStyle =
                "border-[#E5E2DC] bg-[#FAF9F6]/70 hover:border-[#14532D]/50 hover:bg-white";
              let badgeStyle = "bg-[#E9E6DF] text-[#374151]";

              if (isGold) {
                rowStyle =
                  "border-[#C5A46D] bg-gradient-to-r from-[#FBF6EC] to-white shadow-xs";
                badgeStyle =
                  "bg-[#C5A46D] text-white ring-2 ring-[#C5A46D]/30";
              } else if (isSilver) {
                rowStyle =
                  "border-[#9CA3AF] bg-gradient-to-r from-[#F3F4F6] to-white shadow-2xs";
                badgeStyle = "bg-[#6B7280] text-white";
              } else if (isBronze) {
                rowStyle =
                  "border-[#C88A65]/75 bg-gradient-to-r from-[#FDF4EE] to-white shadow-2xs";
                badgeStyle = "bg-[#A96842] text-white";
              }

              return (
                <button
                  key={entry.id}
                  ref={flipRef(entry.id)}
                  type="button"
                  onClick={() => setActiveDetailMemberId(entry.id)}
                  className={`w-full min-h-[76px] rounded-2xl border-2 px-3 sm:px-4 py-3.5 text-left transition-colors duration-300 flex items-center justify-between gap-2 sm:gap-3 active:scale-[0.99] ${rowStyle}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Rank Badge */}
                    <div
                      className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full text-lg font-extrabold tabular-nums ${badgeStyle}`}
                    >
                      {entry.rank}
                    </div>

                    {/* Member Name & Secondary Info */}
                    <div className="min-w-0">
                      <div className="text-xl sm:text-[22px] font-bold text-[#1F2937] leading-snug break-words">
                        {entry.name}
                      </div>
                      <div className="text-base text-[#4B5563] font-medium">
                        {period === "all-time" ? (
                          entry.today_zikr > 0 ? (
                            <span className="text-[#14532D] font-semibold">
                              আজ: +{formatNumber(entry.today_zikr)}
                            </span>
                          ) : (
                            <span>বিস্তারিত দেখুন</span>
                          )
                        ) : (
                          <span>
                            সর্বমোট: {formatNumber(entry.lifetime_zikr)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Member Total & Chevron */}
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="text-right">
                      <div className="text-2xl sm:text-[26px] font-extrabold tabular-nums text-[#14532D]">
                        {formatNumber(entry.zikr_count)}
                      </div>
                    </div>
                    <ChevronRight
                      className="h-5 w-5 sm:h-6 sm:w-6 text-[#6B7280]"
                      aria-hidden="true"
                    />
                  </div>
                </button>
              );
            })}
          </div>

          <p className="mt-5 text-center text-base text-[#4B5563] bg-[#FAF9F6] rounded-xl px-4 py-2.5 border border-[#E5E2DC]">
            সমান সংখ্যার ক্ষেত্রে পরিবারের নির্ধারিত ক্রম অনুযায়ী অবস্থান দেখানো হয়।
          </p>
        </section>

        {/* 5. Peaceful Spiritual Footer */}
        <footer className="pt-4 pb-6 text-center space-y-4">
          <div className="rounded-2xl bg-[#14532D]/6 border border-[#14532D]/15 px-5 py-5">
            <p className="text-xl sm:text-2xl font-bold text-[#14532D] leading-relaxed">
              “হে আল্লাহ, আমাদের এই প্রচেষ্টা কবুল করুন। আমিন।”
            </p>
          </div>

          <div className="flex items-center justify-center gap-4 text-base text-[#6B7280]">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-[#14532D]" />
              <span>পারিবারিক ব্যক্তিগত ওয়েবসাইট</span>
            </span>
            <span>•</span>
            <Link
              href="/admin"
              className="inline-flex items-center gap-1 font-semibold text-[#4B5563] hover:text-[#14532D] underline underline-offset-4"
            >
              <Lock className="h-4 w-4" />
              <span>অ্যাডমিন সংশোধন</span>
            </Link>
          </div>
        </footer>
      </main>

      {/* Individual Member Detail Modal */}
      <MemberDetailModal
        member={activeDetailMember}
        todayDhakaDate={todayDhakaDate}
        onClose={() => setActiveDetailMemberId(null)}
      />
    </div>
  );
}
