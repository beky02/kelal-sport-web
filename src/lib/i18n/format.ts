import { CURRENCY } from "@/config/constants";
import type { ClockConvention, Lang } from "@/types/common";

/**
 * A decimal string grouped for display, `"1250.00"` → `"1,250.00"`, by moving
 * characters only — the amount never passes through a float (FD4).
 */
function groupDecimal(value: string): string {
  if (!/^-?\d+(\.\d+)?$/.test(value)) return value;
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = value.replace("-", "").split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped}.${(fraction + "00").slice(0, 2)}`;
}

/**
 * Two decimals, grouped — the house style for money and odds alike. Amounts
 * from the API are decimal strings; numbers remain only where a screen has not
 * moved to strings yet (wallet, F6).
 */
export const formatNumber = (n: number | string): string =>
  typeof n === "string"
    ? groupDecimal(n)
    : n.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

/**
 * Money with the currency where that language puts it: `ETB 1,250.00` in
 * English, `1,250.00 ብር` in Amharic.
 */
export const formatMoney = (n: number | string, lang: Lang): string =>
  lang === "am"
    ? `${formatNumber(n)} ${CURRENCY.amharic}`
    : `${CURRENCY.code} ${formatNumber(n)}`;

/** Odds to two decimals, for display only (`"2.105"` → `"2.11"`). */
export const formatOdds = (odds: number | string): string =>
  Number(odds).toFixed(2);

/** A rate as a percentage: `"0.15"` → `"15%"`. Display only. */
export const formatPercent = (rate: number | string): string =>
  `${Math.round(Number(rate) * 1000) / 10}%`;

const PERIOD: Record<Lang, [string, string, string, string]> = {
  en: ["night", "morning", "afternoon", "evening"],
  am: ["ሌሊት", "ጠዋት", "ከሰዓት", "ምሽት"],
};

/**
 * Renders a 24h East Africa Time kickoff in the chosen convention.
 *
 * The Ethiopian clock starts at 06:00 EAT, so 19:30 EAT is "1:30 evening". The
 * period word is part of the time, not decoration — without it the hour is
 * ambiguous.
 */
export function formatKickoff(
  time: string | null,
  lang: Lang,
  clock: ClockConvention,
): string {
  if (!time) return "";
  if (clock !== "eth") return time;

  const [hour, minute] = time.split(":").map(Number);
  const ethHour = (hour + 6) % 12 || 12;
  const period = PERIOD[lang][Math.floor(hour / 6)];
  const value = `${ethHour}:${String(minute).padStart(2, "0")}`;

  return lang === "am" ? `${period} ${value}` : `${value} ${period}`;
}
