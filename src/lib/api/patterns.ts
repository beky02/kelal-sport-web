/**
 * The contract's own string patterns (`contracts/openapi.yaml`), for what this
 * app checks and sends upstream. One copy, so they cannot drift apart.
 */

/** `Odds`: a decimal string with 2–3 decimals (`"1.85"`). */
export const ODDS_PATTERN = /^\d{1,6}\.\d{2,3}$/;

/** `Money`: a decimal string with 2 decimals (`"100.00"`). */
export const MONEY_PATTERN = /^-?\d{1,12}\.\d{2}$/;

/** `Phone`: an Ethiopian mobile number, `+251` and nine digits from 9 or 7. */
export const PHONE_PATTERN = /^\+251[79]\d{8}$/;

/**
 * `TicketNo`: 8 Crockford base32 characters and a check character, shown as
 * `XXXX-XXXX-C` (D3). Retail tickets start with R.
 */
export const TICKET_NUMBER_PATTERN =
  /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]$/;
