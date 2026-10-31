import { NextResponse } from "next/server";
import { isAdminRequestAuthenticated } from "@/lib/admin-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import type {
  AdminAuditLogDoc,
  FamilyMemberDoc,
  ZikrSubmissionDoc,
} from "@/lib/types";

export async function GET() {
  const authed = await isAdminRequestAuthenticated();
  if (!authed) {
    return NextResponse.json(
      { ok: false, error: "অনুমতি নেই। অনুগ্রহ করে অ্যাডমিন পিন দিয়ে প্রবেশ করুন।" },
      { status: 401 }
    );
  }

  try {
    const db = getAdminDb();

    const [membersSnap, submissionsSnap, auditSnap] = await Promise.all([
      db.collection("family_members").get(),
      db
        .collection("zikr_submissions")
        .orderBy("submitted_at_ms", "desc")
        .limit(150)
        .get(),
      db
        .collection("admin_audit_logs")
        .orderBy("created_at_ms", "desc")
        .limit(80)
        .get(),
    ]);

    const members = membersSnap.docs
      .map((d) => d.data() as FamilyMemberDoc)
      .sort((a, b) => a.display_order - b.display_order);

    const submissions = submissionsSnap.docs.map(
      (d) => d.data() as ZikrSubmissionDoc
    );

    const auditLogs = auditSnap.docs.map((d) => d.data() as AdminAuditLogDoc);

    return NextResponse.json({
      ok: true,
      members,
      submissions,
      auditLogs,
    });
  } catch (error) {
    console.error("Admin data fetch failed:", error);
    return NextResponse.json(
      { ok: false, error: "অ্যাডমিন তথ্য লোড করতে সমস্যা হয়েছে।" },
      { status: 500 }
    );
  }
}
