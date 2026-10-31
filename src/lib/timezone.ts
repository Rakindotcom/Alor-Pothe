export const DHAKA_TIMEZONE = "Asia/Dhaka";

const BANGLA_MONTHS = [
  "জানুয়ারি",
  "ফেব্রুয়ারি",
  "মার্চ",
  "এপ্রিল",
  "মে",
  "জুন",
  "জুলাই",
  "আগস্ট",
  "সেপ্টেম্বর",
  "অক্টোবর",
  "নভেম্বর",
  "ডিসেম্বর",
] as const;

const EN_NUMBER_FORMATTER = new Intl.NumberFormat("en-US");
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000; // Bangladesh has no DST: fixed UTC+06:00

/**
 * Formats integer counts using standard English comma-separated digits (e.g. 125,450).
 */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return EN_NUMBER_FORMATTER.format(Math.trunc(value));
}

function toDate(input: Date | number | string): Date {
  return input instanceof Date ? input : new Date(input);
}

/**
 * Returns YYYY-MM-DD strictly in Bangladesh Standard Time (Asia/Dhaka, UTC+06:00).
 */
export function getDhakaDateString(input: Date | number | string = new Date()): string {
  const date = toDate(input);
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: DHAKA_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);

    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Fall through to fixed-offset calculation
  }

  const dhaka = new Date(date.getTime() + DHAKA_OFFSET_MS);
  const y = dhaka.getUTCFullYear();
  const m = String(dhaka.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dhaka.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Given a YYYY-MM-DD date string, returns the previous calendar day YYYY-MM-DD.
 */
export function getPreviousDateString(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d) - 24 * 60 * 60 * 1000);
  const py = prev.getUTCFullYear();
  const pm = String(prev.getUTCMonth() + 1).padStart(2, "0");
  const pd = String(prev.getUTCDate()).padStart(2, "0");
  return `${py}-${pm}-${pd}`;
}

/**
 * Formats a YYYY-MM-DD Dhaka date as "30 অক্টোবর, 2026".
 */
export function formatFullDhakaDateBangla(dhakaDate: string): string {
  const parts = dhakaDate.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return dhakaDate;
  }
  const [year, month, day] = parts;
  const monthName = BANGLA_MONTHS[month - 1] ?? "";
  return `${day} ${monthName}, ${year}`;
}

/**
 * Elderly-friendly day label: "আজ" (Today), "গতকাল" (Yesterday), or "28 অক্টোবর, 2026".
 */
export function formatSubmissionDayBangla(
  dhakaDate: string,
  todayDhakaDate: string = getDhakaDateString()
): string {
  if (dhakaDate === todayDhakaDate) return "আজ";
  if (dhakaDate === getPreviousDateString(todayDhakaDate)) return "গতকাল";
  return formatFullDhakaDateBangla(dhakaDate);
}

/**
 * Formats a timestamp as Bangladesh time with a Bangla day-period and
 * English clock digits, e.g. "সকাল 11:45" or "রাত 9:20".
 */
export function formatDhakaTimeBangla(input: Date | number | string): string {
  const date = toDate(input);
  if (Number.isNaN(date.getTime())) return "";

  const dhaka = new Date(date.getTime() + DHAKA_OFFSET_MS);
  const hour24 = dhaka.getUTCHours();
  const minuteStr = String(dhaka.getUTCMinutes()).padStart(2, "0");

  let period: string;
  if (hour24 >= 4 && hour24 < 6) period = "ভোর";
  else if (hour24 >= 6 && hour24 < 12) period = "সকাল";
  else if (hour24 >= 12 && hour24 < 15) period = "দুপুর";
  else if (hour24 >= 15 && hour24 < 18) period = "বিকাল";
  else if (hour24 >= 18 && hour24 < 20) period = "সন্ধ্যা";
  else period = "রাত";

  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${period} ${hour12}:${minuteStr}`;
}
