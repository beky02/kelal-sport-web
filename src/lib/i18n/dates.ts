import type { CalendarSystem, Lang } from "@/types/common";
import { formatEthiopianShort, formatGregorianShort } from "./ethiopian-date";

/**
 * Dates in East Africa Time.
 *
 * The API speaks UTC; every date a person reads is in EAT (UTC+3, no daylight
 * saving). Release 1 shows Gregorian dates (D7); the Ethiopian calendar is a
 * preference, not the default.
 */

const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** `2026-10-04T14:00:00Z` → `2026-10-04` and `17:00`, in East Africa Time. */
export function toEat(iso: string): { date: string; time: string } {
  const eat = new Date(Date.parse(iso) + EAT_OFFSET_MS).toISOString();
  return { date: eat.slice(0, 10), time: eat.slice(11, 16) };
}

/** Today's date in East Africa Time, `YYYY-MM-DD`. */
export const todayEat = (now: Date = new Date()): string =>
  toEat(now.toISOString()).date;

/** `2026-09-30` + 2 → `2026-10-02`. */
export const addDays = (date: string, days: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);

/** The compact date on a board row: `04/10`, or `መስ 24` in the Ethiopian calendar. */
export const formatShortDate = (
  date: string,
  calendar: CalendarSystem,
): string =>
  calendar === "ethiopian"
    ? formatEthiopianShort(date)
    : formatGregorianShort(date);

const LOCALE: Record<Lang, string> = { en: "en-GB", am: "am-ET" };

/** `Thu` / `ሐሙስ` for a `YYYY-MM-DD` date. */
export const formatWeekday = (date: string, lang: Lang): string =>
  new Intl.DateTimeFormat(LOCALE[lang], {
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));

/** `1 Oct` / `ኦክቶ 1`, or `መስ 21` in the Ethiopian calendar — the date strip's day. */
export function formatDayMonth(
  date: string,
  lang: Lang,
  calendar: CalendarSystem,
): string {
  if (calendar === "ethiopian") return formatEthiopianShort(date);
  return new Intl.DateTimeFormat(LOCALE[lang], {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
