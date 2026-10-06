/** Crockford's base32: no I, L, O or U, so a number read aloud can't be misheard. */
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const BASE = CROCKFORD.length;

/**
 * D3's check character for a ticket number's 8 characters: Luhn mod 32 over
 * the Crockford alphabet. Every value from the right is doubled in turn, its
 * base-32 digits summed; the check makes the total a multiple of 32. It
 * catches any single mistyped character.
 */
export function checkCharacter(body: string): string {
  let sum = 0;
  let factor = 2;
  for (let i = body.length - 1; i >= 0; i -= 1) {
    const value = CROCKFORD.indexOf(body[i]);
    if (value < 0) throw new Error(`Not a Crockford character: ${body[i]}`);
    const addend = factor * value;
    sum += Math.floor(addend / BASE) + (addend % BASE);
    factor = factor === 2 ? 1 : 2;
  }
  return CROCKFORD[(BASE - (sum % BASE)) % BASE];
}

/**
 * What someone typed, as Crockford's alphabet forgives it: upper case, without
 * spaces, hyphens or the dashes they become — non-breaking (as the error's own
 * example is written), en and em dashes from chat apps, minus signs — and with
 * O read as 0 and I or L as 1. Whether the result is a code is the caller's
 * check.
 */
export const compactCrockford = (raw: string): string =>
  raw
    .toUpperCase()
    .replace(/[\s\u2010-\u2015\u2212-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");

/**
 * A ticket number as someone typed or linked it → the canonical
 * `XXXX-XXXX-C`, or null.
 *
 * Forgives what the alphabet was designed to forgive — case, spaces and
 * hyphens (typographic dashes too), O read as 0 and I or L as 1 — then
 * insists on 9 Crockford
 * characters whose last is the check character (D3). Anything else is not a
 * ticket number, and is never sent to the API or shown back.
 */
export function normaliseTicketNumber(raw: string): string | null {
  const compact = compactCrockford(raw);
  if (!/^[0-9A-HJKMNP-TV-Z]{9}$/.test(compact)) return null;
  const body = compact.slice(0, 8);
  if (checkCharacter(body) !== compact[8]) return null;
  return `${body.slice(0, 4)}-${body.slice(4)}-${compact[8]}`;
}

/**
 * A path segment as the router hands it over — still percent-encoded, so a
 * number pasted with spaces arrives as `k7q2%20m9xp%20m`. A malformed escape
 * is left as it is (and is then no number).
 */
export function decodeSegment(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
