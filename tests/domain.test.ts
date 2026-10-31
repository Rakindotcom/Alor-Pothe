import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeLeaderboardStats } from "../src/lib/leaderboard";
import { PREDEFINED_FAMILY_MEMBERS } from "../src/lib/members";
import {
  formatNumber,
  formatSubmissionDayBangla,
  getDhakaDateString,
} from "../src/lib/timezone";
import type { FamilyMemberDoc, ZikrSubmissionDoc } from "../src/lib/types";
import { isValidSubmissionId, validateZikrCount } from "../src/lib/validation";

describe("Predefined 12 Family Members", () => {
  it("contains all 12 exact member names with unique deterministic IDs", () => {
    const expectedNames = [
      "Harun Or Rashid",
      "Moazzem Hossain",
      "Rashed Dewan",
      "Saiful Islam",
      "Fauzia Sultana",
      "Tahmina Chowdhury",
      "Tanzina Sarkar",
      "Nazma Akter",
      "Rakin al Shahriar",
      "Tasnimul Hasan",
      "Israt Jahan",
      "Sanjida Islam",
    ];

    assert.equal(PREDEFINED_FAMILY_MEMBERS.length, 12);
    assert.deepEqual(
      PREDEFINED_FAMILY_MEMBERS.map((m) => m.name),
      expectedNames
    );

    const uniqueIds = new Set(PREDEFINED_FAMILY_MEMBERS.map((m) => m.id));
    assert.equal(uniqueIds.size, 12);
  });
});

describe("Zikr Input Validation & Bangla Digit Support", () => {
  it("accepts positive whole numbers in English and Bangla numerals", () => {
    assert.deepEqual(validateZikrCount("100"), { valid: true, value: 100 });
    assert.deepEqual(validateZikrCount("1,000"), { valid: true, value: 1000 });
    assert.deepEqual(validateZikrCount("10,000"), { valid: true, value: 10000 });
    assert.deepEqual(validateZikrCount("১০০০"), { valid: true, value: 1000 });
    assert.deepEqual(validateZikrCount("৫,০০০"), { valid: true, value: 5000 });
    assert.deepEqual(validateZikrCount(2500), { valid: true, value: 2500 });
  });

  it("rejects zero, negative numbers, decimals, empty strings, and invalid characters", () => {
    assert.equal(validateZikrCount("").valid, false);
    assert.equal(validateZikrCount("   ").valid, false);
    assert.equal(validateZikrCount("0").valid, false);
    assert.equal(validateZikrCount(0).valid, false);
    assert.equal(validateZikrCount("-100").valid, false);
    assert.equal(validateZikrCount(-5).valid, false);
    assert.equal(validateZikrCount("12.5").valid, false);
    assert.equal(validateZikrCount("১২.৫").valid, false);
    assert.equal(validateZikrCount(12.5).valid, false);
    assert.equal(validateZikrCount("abc").valid, false);
    assert.equal(validateZikrCount("100abc").valid, false);
    assert.equal(validateZikrCount(2_000_000).valid, false);
  });

  it("validates submission idempotency IDs", () => {
    assert.equal(isValidSubmissionId("sub_1234567890abcdef"), true);
    assert.equal(isValidSubmissionId("short"), false);
    assert.equal(isValidSubmissionId("invalid/path"), false);
  });
});

describe("Asia/Dhaka Timezone Boundaries & Number Formatting", () => {
  it("computes Asia/Dhaka date accurately across midnight UTC+06:00 boundary", () => {
    // 17:59:59 UTC = 23:59:59 Asia/Dhaka (same day)
    assert.equal(getDhakaDateString("2026-10-30T17:59:59.000Z"), "2026-10-30");

    // 18:00:00 UTC = 00:00:00 Asia/Dhaka (next day!)
    assert.equal(getDhakaDateString("2026-10-30T18:00:00.000Z"), "2026-10-31");
  });

  it("formats Today, Yesterday, and English comma-separated numbers properly", () => {
    assert.equal(formatNumber(125450), "125,450");
    assert.equal(formatNumber(0), "0");
    assert.equal(formatSubmissionDayBangla("2026-10-30", "2026-10-30"), "আজ");
    assert.equal(formatSubmissionDayBangla("2026-10-29", "2026-10-30"), "গতকাল");
    assert.equal(
      formatSubmissionDayBangla("2026-10-28", "2026-10-30"),
      "28 অক্টোবর, 2026"
    );
  });
});

describe("Leaderboard Ranking, Family Sums & Midnight Isolation", () => {
  it("shows all 12 members starting at zero zikr even before any submissions", () => {
    const stats = computeLeaderboardStats([], [], "all-time");
    assert.equal(stats.entries.length, 12);
    assert.equal(stats.familyAllTimeTotal, 0);
    assert.equal(stats.familyTodayTotal, 0);
    assert.equal(
      stats.entries.every((e) => e.zikr_count === 0),
      true
    );
  });

  it("ranks highest to lowest, sums family total accurately, and isolates Today vs All-Time", () => {
    const memberDocs: FamilyMemberDoc[] = [
      {
        id: "harun-or-rashid",
        name: "Harun Or Rashid",
        display_order: 1,
        total_zikr: 15000,
        submission_count: 5,
        created_at: "2026-10-29T10:00:00Z",
        updated_at: "2026-10-30T10:00:00Z",
      },
      {
        id: "rakin-al-shahriar",
        name: "Rakin al Shahriar",
        display_order: 9,
        total_zikr: 10000,
        submission_count: 4,
        created_at: "2026-10-29T10:00:00Z",
        updated_at: "2026-10-30T11:00:00Z",
      },
      {
        id: "moazzem-hossain",
        name: "Moazzem Hossain",
        display_order: 2,
        total_zikr: 12500,
        submission_count: 3,
        created_at: "2026-10-29T10:00:00Z",
        updated_at: "2026-10-30T09:00:00Z",
      },
    ];

    const todaySubs: ZikrSubmissionDoc[] = [
      {
        id: "sub_today_1",
        submission_id: "sub_today_1",
        member_id: "rakin-al-shahriar",
        member_name: "Rakin al Shahriar",
        zikr_count: 2000,
        original_zikr_count: 2000,
        submitted_at: "2026-10-30T05:00:00Z",
        submitted_at_ms: 1793336400000,
        dhaka_date: "2026-10-30",
        status: "active",
        updated_at: "2026-10-30T05:00:00Z",
      },
      {
        id: "sub_today_reversed",
        submission_id: "sub_today_reversed",
        member_id: "harun-or-rashid",
        member_name: "Harun Or Rashid",
        zikr_count: 0,
        original_zikr_count: 50000,
        submitted_at: "2026-10-30T05:10:00Z",
        submitted_at_ms: 1793337000000,
        dhaka_date: "2026-10-30",
        status: "reversed",
        updated_at: "2026-10-30T05:15:00Z",
      },
    ];

    const allTimeStats = computeLeaderboardStats(memberDocs, todaySubs, "all-time");
    assert.equal(allTimeStats.familyAllTimeTotal, 37500);
    assert.equal(allTimeStats.familyTodayTotal, 2000);
    assert.equal(allTimeStats.entries[0].name, "Harun Or Rashid");
    assert.equal(allTimeStats.entries[1].name, "Moazzem Hossain");
    assert.equal(allTimeStats.entries[2].name, "Rakin al Shahriar");
    assert.equal(allTimeStats.entries.length, 12);

    const todayStats = computeLeaderboardStats(memberDocs, todaySubs, "today");
    assert.equal(todayStats.activeTotalForPeriod, 2000);
    assert.equal(todayStats.entries[0].name, "Rakin al Shahriar");
    assert.equal(todayStats.entries[0].zikr_count, 2000);
    assert.equal(todayStats.entries[0].lifetime_zikr, 10000);

    const afterMidnightToday = computeLeaderboardStats(memberDocs, [], "today");
    assert.equal(afterMidnightToday.familyTodayTotal, 0);
    assert.equal(afterMidnightToday.familyAllTimeTotal, 37500);
  });
});
