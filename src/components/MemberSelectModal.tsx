"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, User, X } from "lucide-react";
import { PREDEFINED_FAMILY_MEMBERS } from "@/lib/members";
import { formatNumber } from "@/lib/timezone";
import type { LeaderboardEntry } from "@/lib/types";

interface MemberSelectModalProps {
  selectedMemberId: string;
  onSelect: (memberId: string) => void;
  entriesById: Record<string, LeaderboardEntry>;
  disabled?: boolean;
}

export function MemberSelectModal({
  selectedMemberId,
  onSelect,
  entriesById,
  disabled = false,
}: MemberSelectModalProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedMember = useMemo(
    () => PREDEFINED_FAMILY_MEMBERS.find((m) => m.id === selectedMemberId) ?? null,
    [selectedMemberId]
  );

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return PREDEFINED_FAMILY_MEMBERS;
    return PREDEFINED_FAMILY_MEMBERS.filter((m) =>
      m.name.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="পরিবারের সদস্য নির্বাচন করুন"
        className={`w-full min-h-[68px] rounded-2xl border-2 px-5 py-4 text-left transition flex items-center justify-between gap-3 shadow-xs ${
          selectedMember
            ? "border-[#14532D] bg-[#DCFCE7]/35 text-[#1F2937]"
            : "border-[#C7C3B8] bg-white text-[#374151] hover:border-[#14532D]"
        } ${disabled ? "opacity-60 cursor-not-allowed" : "active:scale-[0.99]"}`}
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
              selectedMember
                ? "bg-[#14532D] text-white"
                : "bg-[#DCFCE7] text-[#14532D]"
            }`}
          >
            <User className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            {selectedMember ? (
              <>
                <div className="text-xl sm:text-2xl font-bold text-[#14532D] leading-snug break-words">
                  {selectedMember.name}
                </div>
                <div className="text-base text-[#374151] font-medium">
                  বর্তমান মোট যিকির:{" "}
                  <span className="font-bold tabular-nums text-[#1F2937]">
                    {formatNumber(
                      entriesById[selectedMember.id]?.lifetime_zikr ?? 0
                    )}
                  </span>
                </div>
              </>
            ) : (
              <div className="text-xl sm:text-2xl font-semibold text-[#4B5563]">
                এখানে চাপ দিয়ে আপনার নাম বেছে নিন
              </div>
            )}
          </div>
        </div>
        <ChevronDown
          className="h-7 w-7 shrink-0 text-[#14532D]"
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-[2px] p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="member-select-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-[#FAF9F6] shadow-2xl border border-[#E5E2DC] max-h-[88dvh] flex flex-col overflow-hidden animate-gentle-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-3 bg-[#14532D] px-6 py-5 text-white">
              <div>
                <h3
                  id="member-select-title"
                  className="text-2xl font-bold leading-snug"
                >
                  আপনার নাম নির্বাচন করুন
                </h3>
                <p className="text-base text-[#DCFCE7] mt-0.5">
                  নামের ওপর একবার চাপ দিন (মোট 12 জন সদস্য)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="তালিকা বন্ধ করুন"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition"
              >
                <X className="h-7 w-7" />
              </button>
            </div>

            {/* Optional Search Bar */}
            <div className="px-5 pt-4 pb-2 bg-[#FAF9F6] border-b border-[#E5E2DC]">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-[#6B7280]"
                  aria-hidden="true"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="নাম খুঁজুন (ঐচ্ছিক)..."
                  aria-label="সদস্যের নাম খুঁজুন"
                  className="w-full min-h-[54px] rounded-xl border-2 border-[#D5D1C8] bg-white pl-12 pr-10 py-3 text-lg sm:text-xl font-medium text-[#1F2937] placeholder:text-[#6B7280] focus:border-[#14532D]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="খোঁজার লেখা মুছুন"
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-[#4B5563]"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable 12 Members List */}
            <div
              role="listbox"
              aria-label="পরিবারের সদস্যদের তালিকা"
              className="overflow-y-auto px-4 py-3 space-y-2.5 flex-1"
            >
              {filteredMembers.length === 0 ? (
                <div className="py-10 text-center text-xl text-[#4B5563]">
                  এই নামে কোনো সদস্য পাওয়া যায়নি।
                </div>
              ) : (
                filteredMembers.map((member) => {
                  const isSelected = member.id === selectedMemberId;
                  const memberStats = entriesById[member.id];
                  const lifetimeTotal = memberStats?.lifetime_zikr ?? 0;

                  return (
                    <button
                      key={member.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onSelect(member.id);
                        setOpen(false);
                      }}
                      className={`w-full min-h-[66px] rounded-2xl border-2 px-4 py-3.5 text-left transition flex items-center justify-between gap-3 ${
                        isSelected
                          ? "border-[#14532D] bg-[#DCFCE7] text-[#14532D] shadow-xs"
                          : "border-[#E5E2DC] bg-white text-[#1F2937] hover:border-[#14532D]/60 active:bg-[#DCFCE7]/40"
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-bold tabular-nums ${
                            isSelected
                              ? "bg-[#14532D] text-white"
                              : "bg-[#F3F1EC] text-[#374151]"
                          }`}
                        >
                          {isSelected ? (
                            <Check className="h-5 w-5" />
                          ) : (
                            member.display_order
                          )}
                        </span>
                        <span className="text-xl sm:text-[22px] font-bold leading-snug break-words">
                          {member.name}
                        </span>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className="text-lg font-bold tabular-nums text-[#14532D]">
                          {formatNumber(lifetimeTotal)}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Bottom Close Button */}
            <div className="p-4 bg-white border-t border-[#E5E2DC]">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full min-h-[56px] rounded-2xl border-2 border-[#D5D1C8] bg-[#FAF9F6] text-xl font-bold text-[#1F2937] hover:bg-[#EFECE6] transition"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
