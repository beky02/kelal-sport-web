/**
 * Each terminal route handler and the API call it makes, in one table (F8b).
 *
 * The browser holds the device key but never calls the API (D3), so it signs
 * the API call — its method and contract path — and sends the signature to
 * this app's route, which makes exactly that call. Both sides read this table,
 * so what is signed and what is sent cannot drift apart.
 */
export const TERMINAL_CALLS = {
  /** `activateTerminal`: no token yet and nothing to sign with, so unsigned. */
  activate: {
    route: "/api/terminal/activate",
    method: "POST",
    api: "/v1/retail/terminals/activate",
    signed: false,
  },
  /** `getTerminalSelf`: on boot and every 5 minutes. */
  status: {
    route: "/api/terminal/status",
    method: "GET",
    api: "/v1/retail/terminal",
    signed: true,
  },
  /** `rotateTerminalToken`: when fewer than 7 days of the token remain. */
  token: {
    route: "/api/terminal/token",
    method: "POST",
    api: "/v1/retail/terminal/token",
    signed: true,
  },
  /**
   * `createSlipCode` (F8cc): the kiosk's Book bet, signed over the exact body, which the
   * route forwards byte for byte; 30 per terminal per 10 minutes.
   */
  slipCodes: {
    route: "/api/terminal/slip-codes",
    method: "POST",
    api: "/v1/retail/slip-codes",
    signed: true,
  },
} as const;

export type TerminalCall = (typeof TERMINAL_CALLS)[keyof typeof TERMINAL_CALLS];

/**
 * The kiosk's own reads (F8ca): unsigned GETs of this app's routes, read
 * anonymously as the contract allows (F8ca decision 2), so there is no API
 * call to sign; the routes still insist on an activated terminal's cookie.
 * The catalogue's — `/api/terminal/catalogue/*` — are made by the player's
 * fetchers (`<html data-api>`).
 */
export const TERMINAL_READS = {
  config: "/api/terminal/config",
} as const;

export type TerminalRead = (typeof TERMINAL_READS)[keyof typeof TERMINAL_READS];
export type SignedCall = Extract<TerminalCall, { signed: true }>;

/** How often a terminal reads its status (`getTerminalSelf`: "on boot and every 5 minutes"). */
export const STATUS_INTERVAL_MS = 5 * 60_000;

/** The device headers the browser adds to a signed call (the route adds `X-Device-Id`). */
export const DEVICE_TIMESTAMP = "X-Device-Timestamp";
export const DEVICE_SIGNATURE = "X-Device-Signature";

/**
 * How far a signed call's timestamp may be from the server's clock before the
 * route handler sends back its own time instead of calling the API, which
 * refuses beyond ±30 s (D3). Tighter, so a correction lands first.
 */
export const CLOCK_TOLERANCE_MS = 20_000;

/** The `errors[].code` that carries the server's time when a clock is off. */
export const CLOCK_SKEW = "CLOCK_SKEW";
