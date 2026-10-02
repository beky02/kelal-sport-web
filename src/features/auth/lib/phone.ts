/**
 * Ethiopian mobile numbers: nine digits after +251, starting 9 or 7 (C01).
 * Players type them every way — with spaces, a leading 0, the country code —
 * and the contract wants exactly `+251XXXXXXXXX`.
 */
const MOBILE = /^[79]\d{8}$/;

/** The contract's `Phone` form, or null when the input is not a mobile number. */
export function toE164(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("251")) digits = digits.slice(3);
  else if (digits.startsWith("0")) digits = digits.slice(1);
  return MOBILE.test(digits) ? `+251${digits}` : null;
}

/** `+251 9•• ••• 567`: enough to recognise the phone the code went to, no more. */
export function maskPhone(e164: string): string {
  const digits = e164.replace(/\D/g, "").slice(3);
  return `+251 ${digits[0] ?? "•"}•• ••• ${digits.slice(-3)}`;
}
