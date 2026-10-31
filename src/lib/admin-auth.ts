import crypto from "node:crypto";
import { cookies } from "next/headers";
import { normalizeDigitsToEnglish } from "./validation";

export const ADMIN_COOKIE_NAME = "alor_pothe_admin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function getSigningSecret(): string {
  const explicit = process.env.ADMIN_SESSION_SECRET;
  if (explicit && explicit.length >= 16) {
    return explicit;
  }
  const fallbackSeed = `${process.env.ADMIN_PIN ?? ""}:${
    process.env.FIREBASE_CLIENT_EMAIL ?? ""
  }:${process.env.FIREBASE_PRIVATE_KEY?.slice(0, 64) ?? "alor-pothe-secret"}`;
  return crypto.createHash("sha256").update(fallbackSeed).digest("hex");
}

/**
 * Constant-time verification of the Admin PIN.
 * Normalizes Bangla numerals (০-৯) so elderly/Bangla keyboards work seamlessly.
 */
export function verifyAdminPin(submittedPin: unknown): boolean {
  const configuredPin = process.env.ADMIN_PIN?.trim();
  if (!configuredPin) {
    return false;
  }
  if (typeof submittedPin !== "string") {
    return false;
  }

  const normalizedInput = normalizeDigitsToEnglish(submittedPin).trim();
  if (!normalizedInput) {
    return false;
  }

  const hashA = crypto.createHash("sha256").update(normalizedInput).digest();
  const hashB = crypto.createHash("sha256").update(configuredPin).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Verifies optional shared Family Access Code when FAMILY_ACCESS_CODE is configured.
 */
export function verifyFamilyAccessCode(submittedCode: unknown): boolean {
  const configuredCode = process.env.FAMILY_ACCESS_CODE?.trim();
  if (!configuredCode) {
    return true; // Open family access by default
  }
  if (typeof submittedCode !== "string") {
    return false;
  }
  const normalizedInput = normalizeDigitsToEnglish(submittedCode).trim();
  if (!normalizedInput) {
    return false;
  }
  const hashA = crypto.createHash("sha256").update(normalizedInput).digest();
  const hashB = crypto.createHash("sha256").update(configuredCode).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function createAdminSessionToken(): string {
  const exp = Date.now() + SESSION_TTL_MS;
  const nonce = crypto.randomBytes(12).toString("hex");
  const payload = `${exp}.${nonce}`;
  const sig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(payload)
    .digest("hex");
  return `${payload}.${sig}`;
}

export function verifyAdminSessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [expStr, nonce, providedSig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) {
    return false;
  }

  const payload = `${expStr}.${nonce}`;
  const expectedSig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(payload)
    .digest("hex");

  const bufA = Buffer.from(providedSig, "utf8");
  const bufB = Buffer.from(expectedSig, "utf8");
  if (bufA.length !== bufB.length) return false;

  return crypto.timingSafeEqual(bufA, bufB);
}

export async function isAdminRequestAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminSessionToken(token);
}
