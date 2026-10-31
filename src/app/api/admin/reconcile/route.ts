import { NextResponse } from "next/server";
import { isAdminRequestAuthenticated } from "@/lib/admin-auth";
import { reconcileAllMemberTotals } from "@/lib/zikr-service";

export async function POST() {
  const authed = await isAdminRequestAuthenticated();
  if (!authed) {
    return NextResponse.json(
      { ok: false, error: "অনুমতি নেই। অনুগ্রহ করে অ্যাডমিন পিন দিয়ে প্রবেশ করুন।" },
      { status: 401 }
    );
  }

  try {
    const result = await reconcileAllMemberTotals();
    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("Admin reconciliation failed:", error);
    return NextResponse.json(
      { ok: false, error: "পুনঃগণনা সম্পন্ন করতে সমস্যা হয়েছে।" },
      { status: 500 }
    );
  }
}
