import { CURRENCY } from "@/config/constants";
import type { ClockConvention, Lang } from "@/types/common";

/** Two decimals, grouped — the house style for money and odds alike. */
export const formatNumber = (n: number): string =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 * Money with the currency where that language puts it: `ETB 1,250.00` in
 * English, `1,250.00 ብር` in Amharic.
 */
export const formatMoney = (n: number, lang: Lang): string =>
  lang === "am"
    ? `${formatNumber(n)} ${CURRENCY.amharic}`
    : `${CURRENCY.code} ${formatNumber(n)}`;

export const formatOdds = (n: number): string => n.toFixed(2);

export const formatPercent = (rate: number): string =>
  `${Math.round(rate * 1000) / 10}%`;

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
