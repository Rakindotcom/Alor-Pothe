"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Edit3,
  History,
  Lock,
  LogOut,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  X,
} from "lucide-react";
import { PREDEFINED_FAMILY_MEMBERS } from "@/lib/members";
import {
  formatDhakaTimeBangla,
  formatNumber,
  formatSubmissionDayBangla,
  getDhakaDateString,
} from "@/lib/timezone";
import type {
  AdminAuditLogDoc,
  FamilyMemberDoc,
  ZikrSubmissionDoc,
} from "@/lib/types";
import { validateZikrCount } from "@/lib/validation";
import { FontScaleControl } from "./FontScaleControl";

export function AdminPanel() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Admin data state
  const [members, setMembers] = useState<FamilyMemberDoc[]>([]);
  const [submissions, setSubmissions] = useState<ZikrSubmissionDoc[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogDoc[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [activeTab, setActiveTab] = useState<"submissions" | "audit">(
    "submissions"
  );
  const [filterMemberId, setFilterMemberId] = useState<string>("all");
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);

  // Correction modal state
  const [editingSub, setEditingSub] = useState<ZikrSubmissionDoc | null>(null);
  const [editAction, setEditAction] = useState<"correct" | "reverse">("correct");
  const [newCountInput, setNewCountInput] = useState("");
  const [reasonInput, setReasonInput] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const todayDhakaDate = useMemo(() => getDhakaDateString(), []);

  const fetchAdminData = useCallback(async () => {
    setLoadingData(true);
    setBannerError(null);
    try {
      const res = await fetch("/api/admin/data", { cache: "no-store" });
      if (res.status === 401) {
        setAuthenticated(false);
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setBannerError(data.error || "অ্যাডমিন তথ্য লোড করতে সমস্যা হয়েছে।");
        return;
      }
      setAuthenticated(true);
      setMembers(data.members || []);
      setSubmissions(data.submissions || []);
      setAuditLogs(data.auditLogs || []);
    } catch {
      setBannerError("সার্ভারের সাথে সংযোগ করতে সমস্যা হয়েছে।");
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    void fetchAdminData();
  }, [fetchAdminData]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) {
      setAuthError("অনুগ্রহ করে অ্যাডমিন পিন নম্বরটি লিখুন।");
      return;
    }

    setIsLoggingIn(true);
    setAuthError(null);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinInput }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setAuthError(data.error || "পিন নম্বর সঠিক নয়।");
        return;
      }

      setPinInput("");
      setAuthenticated(true);
      await fetchAdminData();
    } catch {
      setAuthError("লগইন করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthenticated(false);
    setMembers([]);
    setSubmissions([]);
    setAuditLogs([]);
  };

  const handleReconcile = async () => {
    setIsReconciling(true);
    setBannerMessage(null);
    setBannerError(null);
    try {
      const res = await fetch("/api/admin/reconcile", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setBannerError(data.error || "পুনঃগণনা করতে সমস্যা হয়েছে।");
        return;
      }
      setBannerMessage(
        `আলহামদুলিল্লাহ! সকল সদস্যের হিসাব যাচাই সম্পন্ন হয়েছে। পরিবারের সর্বমোট যিকির: ${formatNumber(
          data.familyTotal
        )}`
      );
      await fetchAdminData();
    } catch {
      setBannerError("পুনঃগণনা করতে সমস্যা হয়েছে।");
    } finally {
      setIsReconciling(false);
    }
  };

  const openCorrectionModal = (
    sub: ZikrSubmissionDoc,
    action: "correct" | "reverse"
  ) => {
    setEditingSub(sub);
    setEditAction(action);
    setNewCountInput(action === "correct" ? String(sub.zikr_count || "") : "0");
    setReasonInput("");
    setEditError(null);
  };

  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSub) return;

    setEditError(null);
    let validatedCount = 0;

    if (editAction === "correct") {
      const check = validateZikrCount(newCountInput);
      if (!check.valid) {
        setEditError(check.error);
        return;
      }
      validatedCount = check.value;
    }

    setIsSavingEdit(true);
    try {
      const res = await fetch("/api/admin/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: editingSub.id,
          action: editAction,
          newCount: editAction === "correct" ? validatedCount : undefined,
          reason: reasonInput.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setEditError(data.error || "সংশোধন সংরক্ষণ করা যায়নি।");
        return;
      }

      setBannerMessage(
        editAction === "reverse"
          ? `${editingSub.member_name}-এর ভুল এন্ট্রি বাতিল করা হয়েছে এবং মোট যিকির সমন্বয় করা হয়েছে।`
          : `${editingSub.member_name}-এর যিকির সংখ্যা সংশোধন করে ${formatNumber(
              validatedCount
            )} করা হয়েছে।`
      );
      setEditingSub(null);
      await fetchAdminData();
    } catch {
      setEditError("সার্ভারের সাথে সংযোগ বিচ্ছিন্ন হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const filteredSubmissions = useMemo(() => {
    if (filterMemberId === "all") return submissions;
    return submissions.filter((s) => s.member_id === filterMemberId);
  }, [submissions, filterMemberId]);

  const familyTotal = useMemo(
    () => members.reduce((acc, m) => acc + (Number(m.total_zikr) || 0), 0),
    [members]
  );

  return (
    <div className="min-h-dvh bg-[#FAF9F6] text-[#1F2937] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Top Navigation */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border-2 border-[#14532D]/25 bg-white px-4 py-2 text-lg font-bold text-[#14532D] hover:bg-[#DCFCE7]/50 transition min-h-[46px]"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>মূল পাতায় ফিরে যান</span>
          </Link>
          <FontScaleControl />
        </div>

        {/* Loading Auth State */}
        {authenticated === null && (
          <div className="rounded-3xl border-2 border-[#E5E2DC] bg-white p-10 text-center text-xl font-semibold text-[#4B5563]">
            অ্যাডমিন প্যানেল যাচাই করা হচ্ছে...
          </div>
        )}

        {/* Unauthenticated PIN Login Card */}
        {authenticated === false && (
          <section className="rounded-3xl border-2 border-[#E5E2DC] bg-white p-6 sm:p-8 shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#14532D] text-[#C5A46D]">
              <Lock className="h-8 w-8" />
            </div>
            <h1 className="text-center text-3xl font-extrabold text-[#14532D]">
              অ্যাডমিন সংশোধন প্যানেল
            </h1>
            <p className="mt-2 text-center text-lg text-[#4B5563]">
              ভুলবশত জমা দেওয়া যিকিরের হিসাব সংশোধন বা বাতিল করতে অ্যাডমিন পিন নম্বর দিন।
            </p>

            <form onSubmit={handleLogin} className="mt-6 space-y-5">
              <div>
                <label
                  htmlFor="admin-pin-input"
                  className="block text-xl font-bold text-[#1F2937] mb-2"
                >
                  অ্যাডমিন পিন (PIN)
                </label>
                <input
                  id="admin-pin-input"
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setAuthError(null);
                  }}
                  placeholder="গোপন পিন লিখুন"
                  className="w-full min-h-[64px] rounded-2xl border-2 border-[#C7C3B8] bg-[#FAF9F6] px-5 py-3.5 text-2xl font-bold text-[#1F2937] focus:border-[#14532D] focus:bg-white"
                />
              </div>

              {authError && (
                <div
                  role="alert"
                  className="rounded-2xl border-2 border-[#DC2626]/40 bg-[#FEF2F2] p-4 flex items-center gap-3 text-lg font-bold text-[#991B1B]"
                >
                  <AlertCircle className="h-6 w-6 shrink-0 text-[#DC2626]" />
                  <span>{authError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full min-h-[64px] rounded-2xl bg-[#14532D] text-2xl font-extrabold text-white hover:bg-[#0E3B1F] transition disabled:opacity-60"
              >
                {isLoggingIn ? "যাচাই হচ্ছে..." : "প্রবেশ করুন"}
              </button>
            </form>
          </section>
        )}

        {/* Authenticated Admin Workspace */}
        {authenticated === true && (
          <>
            {/* Admin Header Card */}
            <section className="rounded-3xl bg-gradient-to-br from-[#14532D] to-[#0E3B1F] p-6 text-white shadow-md">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold text-[#DCFCE7]">
                    <ShieldAlert className="h-4 w-4 text-[#C5A46D]" />
                    সুরক্ষিত অ্যাডমিন মোড
                  </span>
                  <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold">
                    আলোর পথে — হিসাব তদারকি ও সংশোধন
                  </h1>
                  <p className="mt-1 text-lg text-[#DCFCE7]">
                    পরিবারের বর্তমান সর্বমোট যিকির:{" "}
                    <strong className="text-white tabular-nums">
                      {formatNumber(familyTotal)}
                    </strong>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-lg font-bold text-white hover:bg-white/25 transition min-h-[48px]"
                >
                  <LogOut className="h-5 w-5" />
                  <span>লগআউট</span>
                </button>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={loadingData}
                  onClick={() => void fetchAdminData()}
                  className="inline-flex items-center gap-2 rounded-xl bg-white text-[#14532D] px-4 py-2.5 text-lg font-bold hover:bg-[#DCFCE7] transition min-h-[48px]"
                >
                  <RefreshCw
                    className={`h-5 w-5 ${loadingData ? "animate-spin" : ""}`}
                  />
                  <span>তালিকা রিফ্রেশ</span>
                </button>

                <button
                  type="button"
                  disabled={isReconciling}
                  onClick={handleReconcile}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#C5A46D] bg-[#C5A46D]/20 text-white px-4 py-2.5 text-lg font-bold hover:bg-[#C5A46D]/35 transition min-h-[48px]"
                >
                  <CheckCircle2 className="h-5 w-5 text-[#DCFCE7]" />
                  <span>
                    {isReconciling
                      ? "পুনঃগণনা হচ্ছে..."
                      : "সব হিসাব যাচাই ও পুনঃগণনা"}
                  </span>
                </button>
              </div>
            </section>

            {/* Status Banners */}
            {bannerMessage && (
              <div className="rounded-2xl border-2 border-[#15803D] bg-[#DCFCE7] p-4 flex items-start justify-between gap-3 text-[#14532D]">
                <div className="flex items-start gap-3 text-lg font-bold">
                  <CheckCircle2 className="h-6 w-6 shrink-0 mt-0.5 text-[#15803D]" />
                  <span>{bannerMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setBannerMessage(null)}
                  aria-label="বার্তা বন্ধ করুন"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            )}

            {bannerError && (
              <div className="rounded-2xl border-2 border-[#DC2626]/40 bg-[#FEF2F2] p-4 flex items-center gap-3 text-lg font-bold text-[#991B1B]">
                <AlertCircle className="h-6 w-6 shrink-0 text-[#DC2626]" />
                <span>{bannerError}</span>
              </div>
            )}

            {/* Tabs: Submissions vs Audit Trail */}
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#EAE6DF] p-1.5 border border-[#E5E2DC]">
              <button
                type="button"
                onClick={() => setActiveTab("submissions")}
                className={`min-h-[54px] rounded-xl px-4 py-2.5 text-lg sm:text-xl font-bold transition ${
                  activeTab === "submissions"
                    ? "bg-[#14532D] text-white shadow-xs"
                    : "text-[#374151] hover:bg-white/60"
                }`}
              >
                সাবমিশন ইতিহাস ({submissions.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("audit")}
                className={`min-h-[54px] rounded-xl px-4 py-2.5 text-lg sm:text-xl font-bold transition ${
                  activeTab === "audit"
                    ? "bg-[#14532D] text-white shadow-xs"
                    : "text-[#374151] hover:bg-white/60"
                }`}
              >
                সংশোধন অডিট লগ ({auditLogs.length})
              </button>
            </div>

            {/* Tab 1: Submission History & Error Correction */}
            {activeTab === "submissions" && (
              <section className="rounded-3xl border-2 border-[#E5E2DC] bg-white p-5 sm:p-6 shadow-sm space-y-5">
                <div>
                  <label
                    htmlFor="member-filter"
                    className="block text-lg font-bold text-[#1F2937] mb-2"
                  >
                    সদস্য অনুযায়ী ফিল্টার করুন:
                  </label>
                  <select
                    id="member-filter"
                    value={filterMemberId}
                    onChange={(e) => setFilterMemberId(e.target.value)}
                    className="w-full min-h-[56px] rounded-xl border-2 border-[#C7C3B8] bg-[#FAF9F6] px-4 py-3 text-xl font-bold text-[#1F2937] focus:border-[#14532D]"
                  >
                    <option value="all">সকল সদস্য (12 জন)</option>
                    {PREDEFINED_FAMILY_MEMBERS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                {loadingData ? (
                  <div className="py-10 text-center text-xl text-[#4B5563]">
                    তথ্য লোড হচ্ছে...
                  </div>
                ) : filteredSubmissions.length === 0 ? (
                  <div className="py-10 text-center text-xl text-[#4B5563] bg-[#FAF9F6] rounded-2xl">
                    কোনো সাবমিশন পাওয়া যায়নি।
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {filteredSubmissions.map((sub) => {
                      const isReversed = sub.status === "reversed";
                      const isCorrected = sub.status === "corrected";

                      return (
                        <div
                          key={sub.id}
                          className={`rounded-2xl border-2 p-4 sm:p-5 transition ${
                            isReversed
                              ? "border-[#E5E2DC] bg-[#F3F4F6] opacity-80"
                              : isCorrected
                              ? "border-[#C5A46D] bg-[#FBF6EC]/60"
                              : "border-[#E5E2DC] bg-[#FAF9F6]"
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xl font-extrabold text-[#1F2937]">
                                  {sub.member_name}
                                </span>
                                {isReversed ? (
                                  <span className="rounded-full bg-[#FEE2E2] px-3 py-0.5 text-sm font-bold text-[#991B1B]">
                                    বাতিলকৃত
                                  </span>
                                ) : isCorrected ? (
                                  <span className="rounded-full bg-[#FEF3C7] px-3 py-0.5 text-sm font-bold text-[#92400E]">
                                    সংশোধিত
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-[#DCFCE7] px-3 py-0.5 text-sm font-bold text-[#14532D]">
                                    সক্রিয়
                                  </span>
                                )}
                              </div>

                              <div className="mt-1 text-base sm:text-lg text-[#4B5563]">
                                {formatSubmissionDayBangla(
                                  sub.dhaka_date,
                                  todayDhakaDate
                                )}{" "}
                                • {formatDhakaTimeBangla(sub.submitted_at_ms)}
                              </div>

                              {sub.original_zikr_count !== sub.zikr_count && (
                                <div className="mt-1 text-base text-[#6B7280] tabular-nums">
                                  প্রাথমিক এন্ট্রি ছিল:{" "}
                                  <strong>
                                    {formatNumber(sub.original_zikr_count)}
                                  </strong>
                                </div>
                              )}

                              {sub.correction_note && (
                                <div className="mt-1 text-base text-[#78531A] italic">
                                  নোট: {sub.correction_note}
                                </div>
                              )}
                            </div>

                            <div
                              className={`text-2xl font-extrabold tabular-nums ${
                                isReversed
                                  ? "line-through text-[#6B7280]"
                                  : "text-[#14532D]"
                              }`}
                            >
                              +{formatNumber(sub.zikr_count)}
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-[#E5E2DC] flex flex-wrap gap-2.5">
                            <button
                              type="button"
                              onClick={() => openCorrectionModal(sub, "correct")}
                              className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#14532D] bg-white px-4 py-2 text-base sm:text-lg font-bold text-[#14532D] hover:bg-[#DCFCE7] transition min-h-[46px]"
                            >
                              <Edit3 className="h-5 w-5" />
                              <span>সংখ্যা সংশোধন</span>
                            </button>

                            {!isReversed && (
                              <button
                                type="button"
                                onClick={() =>
                                  openCorrectionModal(sub, "reverse")
                                }
                                className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#DC2626]/40 bg-white px-4 py-2 text-base sm:text-lg font-bold text-[#B91C1C] hover:bg-[#FEF2F2] transition min-h-[46px]"
                              >
                                <RotateCcw className="h-5 w-5" />
                                <span>বাতিল করুন</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* Tab 2: Immutable Correction Audit Trail */}
            {activeTab === "audit" && (
              <section className="rounded-3xl border-2 border-[#E5E2DC] bg-white p-5 sm:p-6 shadow-sm">
                <h2 className="text-2xl font-extrabold text-[#14532D] mb-4 flex items-center gap-2">
                  <History className="h-6 w-6" />
                  <span>সংশোধনের সম্পূর্ণ অডিট ট্রেইল</span>
                </h2>

                {auditLogs.length === 0 ? (
                  <div className="py-10 text-center text-xl text-[#4B5563] bg-[#FAF9F6] rounded-2xl">
                    এখনো কোনো সংশোধন করা হয়নি।
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="rounded-2xl border border-[#E5E2DC] bg-[#FAF9F6] p-4 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-xl font-bold text-[#1F2937]">
                            {log.member_name}
                          </span>
                          <span
                            className={`rounded-full px-3 py-0.5 text-sm font-bold ${
                              log.action === "reverse"
                                ? "bg-[#FEE2E2] text-[#991B1B]"
                                : "bg-[#FEF3C7] text-[#92400E]"
                            }`}
                          >
                            {log.action === "reverse"
                              ? "এন্ট্রি বাতিল"
                              : "সংখ্যা সংশোধন"}
                          </span>
                        </div>

                        <div className="text-lg font-semibold text-[#14532D] tabular-nums">
                          এন্ট্রি পরিবর্তন: {formatNumber(log.previous_count)}{" "}
                          → {formatNumber(log.new_count)} (পার্থক্য:{" "}
                          {log.delta >= 0
                            ? `+${formatNumber(log.delta)}`
                            : formatNumber(log.delta)}
                          )
                        </div>

                        <div className="text-base text-[#374151] tabular-nums">
                          সদস্যের মোট যিকির:{" "}
                          {formatNumber(log.previous_member_total)} →{" "}
                          <strong>{formatNumber(log.new_member_total)}</strong>
                        </div>

                        <div className="text-base text-[#4B5563]">
                          কারণ: {log.reason}
                        </div>

                        <div className="text-sm text-[#6B7280]">
                          সময়:{" "}
                          {formatSubmissionDayBangla(
                            getDhakaDateString(log.created_at_ms),
                            todayDhakaDate
                          )}{" "}
                          • {formatDhakaTimeBangla(log.created_at_ms)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>

      {/* Correction / Reversal Modal */}
      {editingSub && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-[2px] p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSavingEdit) {
              setEditingSub(null);
            }
          }}
        >
          <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-[#FAF9F6] p-6 shadow-2xl border border-[#E5E2DC] space-y-5 animate-gentle-in">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl font-extrabold text-[#14532D]">
                  {editAction === "reverse"
                    ? "যিকির এন্ট্রি বাতিল করুন"
                    : "যিকিরের সংখ্যা সংশোধন করুন"}
                </h3>
                <p className="text-lg font-semibold text-[#374151] mt-1">
                  সদস্য: {editingSub.member_name} (বর্তমান এন্ট্রি:{" "}
                  <span className="tabular-nums font-bold">
                    {formatNumber(editingSub.zikr_count)}
                  </span>
                  )
                </p>
              </div>
              <button
                type="button"
                disabled={isSavingEdit}
                onClick={() => setEditingSub(null)}
                className="p-2 rounded-full bg-[#E5E2DC] text-[#1F2937]"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSaveCorrection} className="space-y-4">
              {editAction === "correct" ? (
                <div>
                  <label
                    htmlFor="correct-count-input"
                    className="block text-xl font-bold text-[#1F2937] mb-2"
                  >
                    সঠিক যিকিরের সংখ্যা লিখুন
                  </label>
                  <input
                    id="correct-count-input"
                    type="text"
                    inputMode="numeric"
                    value={newCountInput}
                    onChange={(e) => {
                      setNewCountInput(e.target.value);
                      setEditError(null);
                    }}
                    placeholder="যেমন: 5000"
                    className="w-full min-h-[62px] rounded-2xl border-2 border-[#C7C3B8] bg-white px-5 py-3 text-2xl font-extrabold tabular-nums text-[#1F2937] focus:border-[#14532D]"
                  />
                </div>
              ) : (
                <div className="rounded-2xl bg-[#FEF2F2] border border-[#DC2626]/30 p-4 text-lg font-semibold text-[#991B1B]">
                  এই এন্ট্রিটি বাতিল করলে {editingSub.member_name}-এর মোট যিকির থেকে{" "}
                  <strong className="tabular-nums">
                    {formatNumber(editingSub.zikr_count)}
                  </strong>{" "}
                  বিয়োগ হয়ে যাবে এবং অডিট লগে সংরক্ষিত থাকবে।
                </div>
              )}

              <div>
                <label
                  htmlFor="correction-reason"
                  className="block text-lg font-bold text-[#1F2937] mb-2"
                >
                  সংশোধনের কারণ (ঐচ্ছিক নোট)
                </label>
                <input
                  id="correction-reason"
                  type="text"
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder="যেমন: ভুলবশত 5,000 এর বদলে 50,000 লেখা হয়েছিল"
                  className="w-full min-h-[56px] rounded-2xl border-2 border-[#C7C3B8] bg-white px-4 py-3 text-lg font-medium text-[#1F2937] focus:border-[#14532D]"
                />
              </div>

              {editError && (
                <div className="rounded-xl bg-[#FEF2F2] border border-[#DC2626]/40 p-3.5 text-lg font-bold text-[#991B1B]">
                  {editError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  disabled={isSavingEdit}
                  onClick={() => setEditingSub(null)}
                  className="min-h-[58px] rounded-2xl border-2 border-[#C7C3B8] bg-white text-xl font-bold text-[#374151]"
                >
                  ফিরে যান
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className={`min-h-[58px] rounded-2xl text-xl font-extrabold text-white transition ${
                    editAction === "reverse"
                      ? "bg-[#B91C1C] hover:bg-[#991B1B]"
                      : "bg-[#14532D] hover:bg-[#0E3B1F]"
                  }`}
                >
                  {isSavingEdit
                    ? "সংরক্ষণ হচ্ছে..."
                    : editAction === "reverse"
                    ? "নিশ্চিত বাতিল"
                    : "সংশোধন সংরক্ষণ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
