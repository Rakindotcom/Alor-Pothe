import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  createAdminSessionToken,
  verifyAdminPin,
} from "@/lib/admin-auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`admin-login:${ip}`, 6, 10 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: `নিরাপত্তার স্বার্থে সাময়িকভাবে লগইন বন্ধ আছে। অনুগ্রহ করে ${Math.ceil(
          limit.retryAfterSeconds / 60
        )} মিনিট পর চেষ্টা করুন।`,
      },
      { status: 429 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "তথ্য সঠিক নয়।" },
      { status: 400 }
    );
  }

  if (!verifyAdminPin(body.pin)) {
    return NextResponse.json(
      { ok: false, error: "অ্যাডমিন পিন (PIN) সঠিক নয়।" },
      { status: 401 }
    );
  }

  const token = createAdminSessionToken();
  const response = NextResponse.json({ ok: true });

  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 12 * 60 * 60,
  });

  return response;
}
