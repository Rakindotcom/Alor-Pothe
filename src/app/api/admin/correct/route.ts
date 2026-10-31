import { NextResponse } from "next/server";
import { isAdminRequestAuthenticated } from "@/lib/admin-auth";
import {
  adminCorrectSubmissionTransaction,
  AppValidationError,
} from "@/lib/zikr-service";

export async function POST(request: Request) {
  const authed = await isAdminRequestAuthenticated();
  if (!authed) {
    return NextResponse.json(
      { ok: false, error: "অনুমতি নেই। অনুগ্রহ করে অ্যাডমিন পিন দিয়ে প্রবেশ করুন।" },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "তথ্য সঠিক ফরম্যাটে নেই।" },
      { status: 400 }
    );
  }

  try {
    const result = await adminCorrectSubmissionTransaction({
      submissionId: body.submissionId,
      action: body.action,
      newCount: body.newCount,
      reason: body.reason,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof AppValidationError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Admin correction failed:", error);
    return NextResponse.json(
      { ok: false, error: "সংশোধন সংরক্ষণ করতে সমস্যা হয়েছে।" },
      { status: 500 }
    );
  }
}
