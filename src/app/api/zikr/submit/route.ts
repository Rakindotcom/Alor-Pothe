import { NextResponse } from "next/server";
import { verifyFamilyAccessCode } from "@/lib/admin-auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { AppValidationError, submitZikrTransaction } from "@/lib/zikr-service";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`submit:${ip}`, 45, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: `অনেকবার চেষ্টা করা হয়েছে। অনুগ্রহ করে ${limit.retryAfterSeconds} সেকেন্ড অপেক্ষা করুন।`,
      },
      { status: 429 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "পাঠানো তথ্য সঠিক ফরম্যাটে নেই।" },
      { status: 400 }
    );
  }

  if (!verifyFamilyAccessCode(body.familyCode)) {
    return NextResponse.json(
      {
        ok: false,
        error: "পারিবারিক অ্যাক্সেস কোডটি সঠিক নয়। অনুগ্রহ করে সঠিক কোড দিন।",
      },
      { status: 403 }
    );
  }

  try {
    const result = await submitZikrTransaction({
      memberId: body.memberId,
      zikrCount: body.zikrCount,
      submissionId: body.submissionId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof AppValidationError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Error submitting zikr:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "যিকির সংরক্ষণ করতে সমস্যা হয়েছে। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।",
      },
      { status: 500 }
    );
  }
}
