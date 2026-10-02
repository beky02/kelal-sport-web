/**
 * Dates of birth, typed the way Ethiopians write them — day, month, year,
 * Gregorian (D7) — and sent the way the contract wants them (`YYYY-MM-DD`).
 *
 * Only whether it is a real date in the past is checked here. Whether the
 * player is old enough is the API's to say (`REG_UNDERAGE`, REG-04): the
 * minimum age is the tenant's configuration, not this file's.
 */
const TYPED = /^(\d{1,2})\s*[/.\-\s]?\s*(\d{1,2})\s*[/.\-\s]?\s*(\d{4})$/;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n: number) => String(n).padStart(2, "0");

function realDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || month < 1 || month > 12 || day < 1) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** A real calendar date in `YYYY-MM-DD`, no later than `today`. */
export function isIsoDate(value: string, today: Date = new Date()): boolean {
  const match = ISO.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  if (!realDate(year, month, day)) return false;
  const todayIso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  return value <= todayIso;
}

/**
 * `14/03/1996`, `14.03.1996`, `14 03 1996` or `14031996` → `1996-03-14`;
 * null for anything that is not a real past date.
 */
export function parseBirthDate(
  input: string,
  today: Date = new Date(),
): string | null {
  const trimmed = input.trim();
  const compact = /^\d{8}$/.test(trimmed)
    ? `${trimmed.slice(0, 2)}/${trimmed.slice(2, 4)}/${trimmed.slice(4)}`
    : trimmed;
  const match = TYPED.exec(compact);
  if (!match) return null;
  const [day, month, year] = match.slice(1).map(Number);
  const iso = `${year}-${pad(month)}-${pad(day)}`;
  return isIsoDate(iso, today) ? iso : null;
}
