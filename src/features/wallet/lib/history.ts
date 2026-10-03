import { toEat } from "@/lib/i18n/dates";
import type { WalletTxn } from "../types";

export interface HistoryDay {
  /** `YYYY-MM-DD` in East Africa Time. */
  date: string;
  items: WalletTxn[];
}

/**
 * Movements grouped by their date in East Africa Time — the API speaks UTC,
 * and 01:30 in Addis Ababa is still the day before in London. Days and
 * movements keep the API's order (newest first), and pages join up: a day
 * that runs over into the next page keeps one heading.
 */
export function groupByDay(items: readonly WalletTxn[]): HistoryDay[] {
  const days = new Map<string, WalletTxn[]>();
  for (const item of items) {
    const { date } = toEat(item.createdAt);
    const day = days.get(date);
    if (day) day.push(item);
    else days.set(date, [item]);
  }
  return [...days].map(([date, dayItems]) => ({ date, items: dayItems }));
}
