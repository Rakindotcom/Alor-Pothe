import crypto from "node:crypto";
import { getAdminDb } from "./firebase-admin";
import { getPredefinedMember, PREDEFINED_FAMILY_MEMBERS } from "./members";
import { getDhakaDateString } from "./timezone";
import type {
  AdminAuditLogDoc,
  FamilyMemberDoc,
  SubmitZikrResponse,
  ZikrSubmissionDoc,
} from "./types";
import { isValidSubmissionId, validateZikrCount } from "./validation";

export class AppValidationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "AppValidationError";
    this.statusCode = statusCode;
  }
}

/**
 * Idempotently initializes all 12 predefined family members in Firestore.
 * Never duplicates members and never overwrites existing zikr totals.
 */
export async function ensureFamilyMembersInitialized(): Promise<FamilyMemberDoc[]> {
  const db = getAdminDb();
  const nowIso = new Date().toISOString();

  return db.runTransaction(async (tx) => {
    const refs = PREDEFINED_FAMILY_MEMBERS.map((m) =>
      db.collection("family_members").doc(m.id)
    );
    const snaps = await tx.getAll(...refs);

    const results: FamilyMemberDoc[] = [];

    snaps.forEach((snap, idx) => {
      const predefined = PREDEFINED_FAMILY_MEMBERS[idx];
      const ref = refs[idx];

      if (!snap.exists) {
        const newDoc: FamilyMemberDoc = {
          id: predefined.id,
          name: predefined.name,
          display_order: predefined.display_order,
          total_zikr: 0,
          submission_count: 0,
          created_at: nowIso,
          updated_at: nowIso,
        };
        tx.create(ref, newDoc);
        results.push(newDoc);
      } else {
        const data = snap.data() as Partial<FamilyMemberDoc>;
        const existingTotal = Math.max(0, Math.trunc(Number(data.total_zikr ?? 0)));
        const existingSubCount = Math.max(
          0,
          Math.trunc(Number(data.submission_count ?? 0))
        );

        const merged: FamilyMemberDoc = {
          id: predefined.id,
          name: predefined.name,
          display_order: predefined.display_order,
          total_zikr: existingTotal,
          submission_count: existingSubCount,
          created_at: data.created_at ?? nowIso,
          updated_at: data.updated_at ?? nowIso,
        };

        // Keep canonical name and display_order consistent without touching total_zikr
        if (
          data.name !== predefined.name ||
          data.display_order !== predefined.display_order ||
          data.id !== predefined.id
        ) {
          tx.update(ref, {
            id: predefined.id,
            name: predefined.name,
            display_order: predefined.display_order,
          });
        }

        results.push(merged);
      }
    });

    return results;
  });
}

export interface SubmitZikrInput {
  memberId: unknown;
  zikrCount: unknown;
  submissionId: unknown;
}

/**
 * Atomically records a zikr submission and increments the member's cumulative total.
 * Strictly idempotent by `submissionId`: duplicate network retries will never double-add.
 */
export async function submitZikrTransaction(
  input: SubmitZikrInput
): Promise<SubmitZikrResponse> {
  if (typeof input.memberId !== "string" || !input.memberId.trim()) {
    throw new AppValidationError("অনুগ্রহ করে পরিবারের সদস্যের নাম নির্বাচন করুন।", 400);
  }

  const predefined = getPredefinedMember(input.memberId.trim());
  if (!predefined) {
    throw new AppValidationError("নির্বাচিত সদস্য তালিকায় পাওয়া যায়নি।", 400);
  }

  const countCheck = validateZikrCount(input.zikrCount);
  if (!countCheck.valid) {
    throw new AppValidationError(countCheck.error, 400);
  }

  if (!isValidSubmissionId(input.submissionId)) {
    throw new AppValidationError(
      "সাবমিশন আইডি সঠিক নয়। অনুগ্রহ করে পেজটি রিফ্রেশ করে আবার চেষ্টা করুন।",
      400
    );
  }

  const validCount = countCheck.value;
  const submissionId = input.submissionId;
  const db = getAdminDb();

  return db.runTransaction(async (tx) => {
    const subRef = db.collection("zikr_submissions").doc(submissionId);
    const memberRef = db.collection("family_members").doc(predefined.id);

    const [subSnap, memberSnap] = await tx.getAll(subRef, memberRef);

    // Idempotent handling: if this exact submissionId was already committed, return safely!
    if (subSnap.exists) {
      const existingSub = subSnap.data() as ZikrSubmissionDoc;
      const currentMemberTotal = memberSnap.exists
        ? Math.max(0, Math.trunc(Number(memberSnap.data()?.total_zikr ?? 0)))
        : existingSub.zikr_count;

      return {
        ok: true,
        alreadyProcessed: true,
        submissionId,
        memberId: predefined.id,
        memberName: predefined.name,
        previousTotal: Math.max(0, currentMemberTotal - existingSub.zikr_count),
        addedCount: existingSub.zikr_count,
        updatedTotal: currentMemberTotal,
        dhakaDate: existingSub.dhaka_date,
        submittedAt: existingSub.submitted_at,
      };
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const nowMs = now.getTime();
    const dhakaDate = getDhakaDateString(now);

    const previousTotal = memberSnap.exists
      ? Math.max(0, Math.trunc(Number(memberSnap.data()?.total_zikr ?? 0)))
      : 0;
    const previousSubCount = memberSnap.exists
      ? Math.max(0, Math.trunc(Number(memberSnap.data()?.submission_count ?? 0)))
      : 0;

    // Crucial requirement: ALWAYS increment previous total, NEVER overwrite it with validCount
    const updatedTotal = previousTotal + validCount;
    const updatedSubCount = previousSubCount + 1;

    const submissionDoc: ZikrSubmissionDoc = {
      id: submissionId,
      submission_id: submissionId,
      member_id: predefined.id,
      member_name: predefined.name,
      zikr_count: validCount,
      original_zikr_count: validCount,
      submitted_at: nowIso,
      submitted_at_ms: nowMs,
      dhaka_date: dhakaDate,
      status: "active",
      updated_at: nowIso,
      correction_note: null,
    };

    tx.create(subRef, submissionDoc);

    if (memberSnap.exists) {
      tx.update(memberRef, {
        name: predefined.name,
        display_order: predefined.display_order,
        total_zikr: updatedTotal,
        submission_count: updatedSubCount,
        updated_at: nowIso,
      });
    } else {
      const newMemberDoc: FamilyMemberDoc = {
        id: predefined.id,
        name: predefined.name,
        display_order: predefined.display_order,
        total_zikr: updatedTotal,
        submission_count: updatedSubCount,
        created_at: nowIso,
        updated_at: nowIso,
      };
      tx.set(memberRef, newMemberDoc);
    }

    return {
      ok: true,
      alreadyProcessed: false,
      submissionId,
      memberId: predefined.id,
      memberName: predefined.name,
      previousTotal,
      addedCount: validCount,
      updatedTotal,
      dhakaDate,
      submittedAt: nowIso,
    };
  });
}

export interface AdminCorrectionInput {
  submissionId: unknown;
  action: unknown; // "correct" | "reverse"
  newCount?: unknown;
  reason?: unknown;
}

export interface AdminCorrectionResult {
  ok: true;
  submission: ZikrSubmissionDoc;
  previousMemberTotal: number;
  newMemberTotal: number;
  auditLog: AdminAuditLogDoc;
}

/**
 * Atomically corrects or reverses a mistaken submission, recalculates the affected
 * member's cumulative total, and writes an immutable audit log record.
 */
export async function adminCorrectSubmissionTransaction(
  input: AdminCorrectionInput
): Promise<AdminCorrectionResult> {
  if (!isValidSubmissionId(input.submissionId)) {
    throw new AppValidationError("সাবমিশন আইডি সঠিক নয়।", 400);
  }

  if (input.action !== "correct" && input.action !== "reverse") {
    throw new AppValidationError("সংশোধনের ধরন সঠিক নয়।", 400);
  }

  let targetNewCount = 0;
  if (input.action === "correct") {
    const check = validateZikrCount(input.newCount);
    if (!check.valid) {
      throw new AppValidationError(check.error, 400);
    }
    targetNewCount = check.value;
  }

  const rawReason =
    typeof input.reason === "string" ? input.reason.trim().slice(0, 300) : "";
  const reason =
    rawReason ||
    (input.action === "reverse"
      ? "অ্যাডমিন কর্তৃক ভুল এন্ট্রি বাতিল করা হয়েছে"
      : "অ্যাডমিন কর্তৃক সংখ্যা সংশোধন করা হয়েছে");

  const db = getAdminDb();
  const submissionId = input.submissionId;

  return db.runTransaction(async (tx) => {
    const subRef = db.collection("zikr_submissions").doc(submissionId);
    const subSnap = await tx.get(subRef);

    if (!subSnap.exists) {
      throw new AppValidationError("নির্বাচিত যিকিরের হিসাবটি খুঁজে পাওয়া যায়নি।", 404);
    }

    const subData = subSnap.data() as ZikrSubmissionDoc;
    const memberRef = db.collection("family_members").doc(subData.member_id);
    const memberSnap = await tx.get(memberRef);

    const oldEffective =
      subData.status === "reversed" ? 0 : Math.max(0, Math.trunc(Number(subData.zikr_count || 0)));
    const newEffective = input.action === "reverse" ? 0 : targetNewCount;
    const newStatus = input.action === "reverse" ? "reversed" : "corrected";

    if (oldEffective === newEffective && subData.status === newStatus) {
      throw new AppValidationError("পূর্বেই একই সংখ্যা সংরক্ষিত রয়েছে।", 400);
    }

    const delta = newEffective - oldEffective;
    const previousMemberTotal = memberSnap.exists
      ? Math.max(0, Math.trunc(Number(memberSnap.data()?.total_zikr ?? 0)))
      : 0;
    const newMemberTotal = Math.max(0, previousMemberTotal + delta);

    const wasCounted = subData.status !== "reversed";
    const isNowCounted = newStatus !== "reversed";
    const subCountDelta = (isNowCounted ? 1 : 0) - (wasCounted ? 1 : 0);
    const prevSubCount = memberSnap.exists
      ? Math.max(0, Math.trunc(Number(memberSnap.data()?.submission_count ?? 0)))
      : 0;
    const newSubCount = Math.max(0, prevSubCount + subCountDelta);

    const now = new Date();
    const nowIso = now.toISOString();
    const nowMs = now.getTime();

    const updatedSub: ZikrSubmissionDoc = {
      ...subData,
      zikr_count: newEffective,
      status: newStatus,
      updated_at: nowIso,
      correction_note: reason,
    };

    tx.update(subRef, {
      zikr_count: newEffective,
      status: newStatus,
      updated_at: nowIso,
      correction_note: reason,
    });

    const predefined = getPredefinedMember(subData.member_id);
    if (memberSnap.exists) {
      tx.update(memberRef, {
        total_zikr: newMemberTotal,
        submission_count: newSubCount,
        updated_at: nowIso,
      });
    } else if (predefined) {
      tx.set(memberRef, {
        id: predefined.id,
        name: predefined.name,
        display_order: predefined.display_order,
        total_zikr: newMemberTotal,
        submission_count: newSubCount,
        created_at: nowIso,
        updated_at: nowIso,
      });
    }

    const auditId = `audit_${nowMs}_${crypto.randomBytes(4).toString("hex")}`;
    const auditRef = db.collection("admin_audit_logs").doc(auditId);
    const auditLog: AdminAuditLogDoc = {
      id: auditId,
      submission_id: submissionId,
      member_id: subData.member_id,
      member_name: subData.member_name,
      action: input.action === "reverse" ? "reverse" : "correct",
      previous_count: oldEffective,
      new_count: newEffective,
      delta,
      previous_member_total: previousMemberTotal,
      new_member_total: newMemberTotal,
      reason,
      created_at: nowIso,
      created_at_ms: nowMs,
    };

    tx.create(auditRef, auditLog);

    return {
      ok: true,
      submission: updatedSub,
      previousMemberTotal,
      newMemberTotal,
      auditLog,
    };
  });
}

/**
 * Reconciles all 12 family members' totals directly from valid submission records
 * to guarantee 100% mathematical consistency at any point.
 */
export async function reconcileAllMemberTotals(): Promise<{
  reconciledMembers: number;
  familyTotal: number;
}> {
  const db = getAdminDb();
  const nowIso = new Date().toISOString();

  return db.runTransaction(async (tx) => {
    const subsQuery = db.collection("zikr_submissions");
    const memberRefs = PREDEFINED_FAMILY_MEMBERS.map((m) =>
      db.collection("family_members").doc(m.id)
    );

    const [subsSnap, ...memberSnaps] = await Promise.all([
      tx.get(subsQuery),
      ...memberRefs.map((ref) => tx.get(ref)),
    ]);

    const derivedTotals = new Map<string, number>();
    const derivedCounts = new Map<string, number>();

    subsSnap.forEach((doc) => {
      const sub = doc.data() as ZikrSubmissionDoc;
      if (sub.status === "reversed") return;
      const c = Math.max(0, Math.trunc(Number(sub.zikr_count || 0)));
      if (c > 0) {
        derivedTotals.set(sub.member_id, (derivedTotals.get(sub.member_id) ?? 0) + c);
        derivedCounts.set(sub.member_id, (derivedCounts.get(sub.member_id) ?? 0) + 1);
      }
    });

    let reconciledMembers = 0;
    let familyTotal = 0;

    PREDEFINED_FAMILY_MEMBERS.forEach((predefined, idx) => {
      const snap = memberSnaps[idx];
      const ref = memberRefs[idx];
      const exactTotal = derivedTotals.get(predefined.id) ?? 0;
      const exactCount = derivedCounts.get(predefined.id) ?? 0;
      familyTotal += exactTotal;

      if (!snap.exists) {
        tx.set(ref, {
          id: predefined.id,
          name: predefined.name,
          display_order: predefined.display_order,
          total_zikr: exactTotal,
          submission_count: exactCount,
          created_at: nowIso,
          updated_at: nowIso,
        });
        reconciledMembers++;
      } else {
        const data = snap.data() as Partial<FamilyMemberDoc>;
        if (
          Number(data.total_zikr ?? 0) !== exactTotal ||
          Number(data.submission_count ?? 0) !== exactCount ||
          data.name !== predefined.name
        ) {
          tx.update(ref, {
            name: predefined.name,
            display_order: predefined.display_order,
            total_zikr: exactTotal,
            submission_count: exactCount,
            updated_at: nowIso,
          });
          reconciledMembers++;
        }
      }
    });

    return { reconciledMembers, familyTotal };
  });
}
