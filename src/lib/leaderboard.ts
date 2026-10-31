import { PREDEFINED_FAMILY_MEMBERS } from "./members";
import type {
  FamilyMemberDoc,
  LeaderboardEntry,
  LeaderboardPeriod,
  ZikrSubmissionDoc,
} from "./types";

export interface ComputedFamilyStats {
  entries: LeaderboardEntry[];
  entriesById: Record<string, LeaderboardEntry>;
  familyAllTimeTotal: number;
  familyTodayTotal: number;
  activeTotalForPeriod: number;
}

/**
 * Builds the complete 12-member leaderboard and family statistics.
 *
 * Tie-breaking rule (consistent & documented):
 * 1. Ranked from highest to lowest zikr count for the selected period.
 * 2. When two members have the exact same zikr count, order is determined
 *    consistently by the predefined family member list order (1 to 12).
 */
export function computeLeaderboardStats(
  memberDocs: FamilyMemberDoc[],
  todaySubmissions: ZikrSubmissionDoc[],
  period: LeaderboardPeriod
): ComputedFamilyStats {
  const memberMap = new Map<string, FamilyMemberDoc>();
  for (const doc of memberDocs) {
    memberMap.set(doc.id, doc);
  }

  // Sum valid (non-reversed) submissions for today's Dhaka date
  const todayTotals = new Map<string, number>();
  for (const sub of todaySubmissions) {
    if (sub.status === "reversed") continue;
    const count = Number(sub.zikr_count) || 0;
    if (count > 0) {
      todayTotals.set(sub.member_id, (todayTotals.get(sub.member_id) ?? 0) + count);
    }
  }

  // Ensure all 12 predefined family members are always present
  const baseItems = PREDEFINED_FAMILY_MEMBERS.map((predefined) => {
    const stored = memberMap.get(predefined.id);
    const lifetime_zikr = Math.max(0, Math.trunc(Number(stored?.total_zikr ?? 0)));
    const today_zikr = Math.max(0, Math.trunc(todayTotals.get(predefined.id) ?? 0));
    const submission_count = Math.max(0, Math.trunc(Number(stored?.submission_count ?? 0)));

    return {
      id: predefined.id,
      name: predefined.name,
      display_order: predefined.display_order,
      lifetime_zikr,
      today_zikr,
      submission_count,
      updated_at: stored?.updated_at ?? "",
    };
  });

  // Compute all-time ranks
  const sortedAllTime = [...baseItems].sort((a, b) => {
    if (b.lifetime_zikr !== a.lifetime_zikr) {
      return b.lifetime_zikr - a.lifetime_zikr;
    }
    return a.display_order - b.display_order;
  });
  const allTimeRankMap = new Map<string, number>();
  sortedAllTime.forEach((item, idx) => {
    allTimeRankMap.set(item.id, idx + 1);
  });

  // Compute today ranks
  const sortedToday = [...baseItems].sort((a, b) => {
    if (b.today_zikr !== a.today_zikr) {
      return b.today_zikr - a.today_zikr;
    }
    return a.display_order - b.display_order;
  });
  const todayRankMap = new Map<string, number>();
  sortedToday.forEach((item, idx) => {
    todayRankMap.set(item.id, idx + 1);
  });

  const activeSorted = period === "today" ? sortedToday : sortedAllTime;

  const entries: LeaderboardEntry[] = activeSorted.map((item, idx) => ({
    id: item.id,
    name: item.name,
    display_order: item.display_order,
    rank: idx + 1,
    all_time_rank: allTimeRankMap.get(item.id) ?? item.display_order,
    today_rank: todayRankMap.get(item.id) ?? item.display_order,
    zikr_count: period === "today" ? item.today_zikr : item.lifetime_zikr,
    lifetime_zikr: item.lifetime_zikr,
    today_zikr: item.today_zikr,
    submission_count: item.submission_count,
    updated_at: item.updated_at,
  }));

  const entriesById: Record<string, LeaderboardEntry> = {};
  let familyAllTimeTotal = 0;
  let familyTodayTotal = 0;

  for (const entry of entries) {
    entriesById[entry.id] = entry;
    familyAllTimeTotal += entry.lifetime_zikr;
    familyTodayTotal += entry.today_zikr;
  }

  return {
    entries,
    entriesById,
    familyAllTimeTotal,
    familyTodayTotal,
    activeTotalForPeriod: period === "today" ? familyTodayTotal : familyAllTimeTotal,
  };
}
