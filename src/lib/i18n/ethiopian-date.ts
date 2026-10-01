/**
 * Gregorian ↔ Ethiopian (Amete Mihret) calendar conversion.
 *
 * The Ethiopian year has twelve 30-day months plus Pagumen, a 5- or 6-day
 * thirteenth. New year (Meskerem 1) lands on 11 September, or 12 September in
 * the year preceding a Gregorian leap year. Rather than special-case that, both
 * directions go through the Julian Day Number, which is exact.
 *
 * Dates on the board are shown in whichever calendar the reader uses, so this is
 * product surface, not a nicety.
 */

/** JDN of Ethiopian 1-1-1 (Amete Mihret). */
const JD_EPOCH_AMETE_MIHRET = 1723856;

export interface EthiopianDate {
  year: number;
  /** 1–13, where 13 is Pagumen. */
  month: number;
  day: number;
}

/** Julian Day Number for a Gregorian date, at noon. */
export function gregorianToJdn(
  year: number,
  month: number,
  day: number,
): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

export function jdnToEthiopian(jdn: number): EthiopianDate {
  const offset = jdn - JD_EPOCH_AMETE_MIHRET;
  const r = ((offset % 1461) + 1461) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);

  return {
    year:
      4 * Math.floor(offset / 1461) +
      Math.floor(r / 365) -
      Math.floor(r / 1460),
    month: Math.floor(n / 30) + 1,
    day: (n % 30) + 1,
  };
}

/** `date` is an ISO `YYYY-MM-DD`. */
export function isoToEthiopian(date: string): EthiopianDate {
  const [year, month, day] = date.split("-").map(Number);
  return jdnToEthiopian(gregorianToJdn(year, month, day));
}

export const ETHIOPIAN_MONTHS = [
  "መስከረም",
  "ጥቅምት",
  "ኅዳር",
  "ታኅሣሥ",
  "ጥር",
  "የካቲት",
  "መጋቢት",
  "ሚያዝያ",
  "ግንቦት",
  "ሰኔ",
  "ሐምሌ",
  "ነሐሴ",
  "ጳጉሜን",
] as const;

/** Short forms, as the design writes them: Meskerem 18 → `መስ 18`. */
export const ETHIOPIAN_MONTHS_SHORT = [
  "መስ",
  "ጥቅ",
  "ኅዳ",
  "ታኅ",
  "ጥር",
  "የካ",
  "መጋ",
  "ሚያ",
  "ግን",
  "ሰኔ",
  "ሐም",
  "ነሐ",
  "ጳጉ",
] as const;

/** `መስ 18` — the compact form used on board rows and the date strip. */
export function formatEthiopianShort(date: string): string {
  const { month, day } = isoToEthiopian(date);
  return `${ETHIOPIAN_MONTHS_SHORT[month - 1]} ${day}`;
}

/** `መስከረም 18 2019` — for headings, where there is room. */
export function formatEthiopianLong(date: string): string {
  const { year, month, day } = isoToEthiopian(date);
  return `${ETHIOPIAN_MONTHS[month - 1]} ${day} ${year}`;
}

/** `28/09` — the compact Gregorian form the English board uses. */
export function formatGregorianShort(date: string): string {
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}
