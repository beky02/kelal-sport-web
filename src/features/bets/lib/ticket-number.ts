/**
 * The contract's `TicketNo`: 8 Crockford base32 characters and a check
 * character, shown as `XXXX-XXXX-C` (D3). Retail tickets start with R.
 */
export const TICKET_NUMBER =
  /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]$/;
