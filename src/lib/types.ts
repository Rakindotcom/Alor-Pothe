export type LeaderboardPeriod = "all-time" | "today";

export type SubmissionStatus = "active" | "corrected" | "reversed";

export interface FamilyMemberDoc {
  id: string;
  name: string;
  display_order: number;
  total_zikr: number;
  submission_count: number;
  created_at: string;
  updated_at: string;
}

export interface ZikrSubmissionDoc {
  id: string;
  submission_id: string;
  member_id: string;
  member_name: string;
  zikr_count: number;
  original_zikr_count: number;
  submitted_at: string;
  submitted_at_ms: number;
  dhaka_date: string; // YYYY-MM-DD in Asia/Dhaka
  status: SubmissionStatus;
  updated_at: string;
  correction_note?: string | null;
}

export interface AdminAuditLogDoc {
  id: string;
  submission_id: string;
  member_id: string;
  member_name: string;
  action: "correct" | "reverse";
  previous_count: number;
  new_count: number;
  delta: number;
  previous_member_total: number;
  new_member_total: number;
  reason: string;
  created_at: string;
  created_at_ms: number;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  display_order: number;
  rank: number;
  all_time_rank: number;
  today_rank: number;
  zikr_count: number; // Value for selected period
  lifetime_zikr: number;
  today_zikr: number;
  submission_count: number;
  updated_at: string;
}

export interface SubmitZikrResponse {
  ok: true;
  alreadyProcessed: boolean;
  submissionId: string;
  memberId: string;
  memberName: string;
  previousTotal: number;
  addedCount: number;
  updatedTotal: number;
  dhakaDate: string;
  submittedAt: string;
}
