import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { ensureFamilyMembersInitialized } from "@/lib/zikr-service";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`init:${ip}`, 30, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।" },
      { status: 429 }
    );
  }

  try {
    const members = await ensureFamilyMembersInitialized();
    return NextResponse.json({
      ok: true,
      count: members.length,
    });
  } catch (error) {
    console.error("Failed to initialize family members:", error);
    return NextResponse.json(
      { ok: false, error: "সার্ভারের সাথে সংযোগ করতে সমস্যা হয়েছে।" },
      { status: 500 }
    );
  }
}
