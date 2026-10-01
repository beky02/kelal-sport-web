/** The contract's booking-code pattern: 7 Crockford base32 characters. */
export const BOOKING_CODE = /^[0-9A-HJKMNP-TV-Z]{7}$/;

/**
 * A code as someone typed or linked it → the canonical code, or null.
 *
 * Booking codes are Crockford base32, read aloud at shops and copied from
 * Telegram, so this forgives what that alphabet was designed to forgive: case,
 * spaces and hyphens, and the letters it leaves out (O is read as 0, I and L as
 * 1). Anything still outside the contract's pattern is not a code.
 */
export function normaliseBookingCode(raw: string): string | null {
  const code = raw
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  return BOOKING_CODE.test(code) ? code : null;
}
