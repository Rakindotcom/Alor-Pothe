export const MAX_SINGLE_ZIKR_SUBMISSION = 1_000_000;

const BANGLA_DIGIT_MAP: Record<string, string> = {
  "০": "0",
  "১": "1",
  "২": "2",
  "৩": "3",
  "৪": "4",
  "৫": "5",
  "৬": "6",
  "৭": "7",
  "৮": "8",
  "৯": "9",
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
};

/**
 * Converts Bangla (০-৯) or Arabic-Indic digits into standard English digits (0-9).
 */
export function normalizeDigitsToEnglish(raw: string): string {
  return raw.replace(/[০-৯٠-٩]/g, (ch) => BANGLA_DIGIT_MAP[ch] ?? ch);
}

export type ValidationResult =
  | { valid: true; value: number }
  | { valid: false; error: string };

/**
 * Strictly validates a submitted zikr count:
 * - Accepts positive whole integers only (supports Bangla or English numerals).
 * - Rejects empty strings, zero, negative numbers, decimals, and non-numeric characters.
 */
export function validateZikrCount(input: unknown): ValidationResult {
  if (typeof input === "number") {
    if (!Number.isFinite(input) || !Number.isInteger(input)) {
      return {
        valid: false,
        error: "শুধুমাত্র পূর্ণসংখ্যা লিখুন (দশমিক সংখ্যা গ্রহণযোগ্য নয়)।",
      };
    }
    if (input <= 0) {
      return {
        valid: false,
        error: "যিকিরের সংখ্যা অবশ্যই 1 বা তার বেশি হতে হবে।",
      };
    }
    if (input > MAX_SINGLE_ZIKR_SUBMISSION) {
      return {
        valid: false,
        error: "একবারে সর্বোচ্চ 1,000,000 যিকির যুক্ত করা যাবে।",
      };
    }
    return { valid: true, value: input };
  }

  if (typeof input !== "string") {
    return {
      valid: false,
      error: "অনুগ্রহ করে সঠিক যিকিরের সংখ্যা লিখুন।",
    };
  }

  const trimmed = normalizeDigitsToEnglish(input).trim();
  if (!trimmed) {
    return {
      valid: false,
      error: "অনুগ্রহ করে যিকিরের সংখ্যা লিখুন।",
    };
  }

  if (trimmed.startsWith("-")) {
    return {
      valid: false,
      error: "ঋণাত্মক (মাইনাস) সংখ্যা গ্রহণযোগ্য নয়।",
    };
  }

  if (trimmed.includes(".") || trimmed.includes("।")) {
    return {
      valid: false,
      error: "দশমিক সংখ্যা গ্রহণযোগ্য নয়। শুধুমাত্র পূর্ণসংখ্যা লিখুন।",
    };
  }

  const cleaned = trimmed.replace(/,/g, "");

  if (!/^[0-9]+$/.test(cleaned)) {
    return {
      valid: false,
      error: "অনুগ্রহ করে শুধুমাত্র সংখ্যায় লিখুন (যেমন: 100 বা 1000)।",
    };
  }

  const parsed = Number(cleaned);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return {
      valid: false,
      error: "যিকিরের সংখ্যা অবশ্যই 1 বা তার বেশি হতে হবে।",
    };
  }

  if (parsed > MAX_SINGLE_ZIKR_SUBMISSION) {
    return {
      valid: false,
      error: "একবারে সর্বোচ্চ 1,000,000 যিকির যুক্ত করা যাবে।",
    };
  }

  return { valid: true, value: parsed };
}

/**
 * Validates idempotency key format for submissions.
 */
export function isValidSubmissionId(id: unknown): id is string {
  return typeof id === "string" && /^[a-zA-Z0-9_-]{12,80}$/.test(id);
}
