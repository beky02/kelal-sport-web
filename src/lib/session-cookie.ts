/**
 * Names the browser and the server agree on, with no server-only code so the
 * proxy and `apiClient` can import them.
 *
 * The session cookie holds the API's tokens, sealed; the browser never reads
 * it (httpOnly) and never sees what is inside (`lib/server/session.ts`). The
 * device cookie is a random id that stands for this browser install — what
 * contract request 004 calls `X-Client-Device`.
 */
export const SESSION_COOKIE = "kelal.session";
export const DEVICE_COOKIE = "kelal.device";

/**
 * Every POST this site's own pages make carries this header (C18 §4.4). No
 * other origin can send it without a CORS preflight, and this app answers no
 * preflight, so a cross-site page cannot reach a mutating route handler even
 * with the cookie attached (`lib/server/csrf.ts`).
 */
export const CSRF_HEADER = "X-Requested-With";
export const CSRF_VALUE = "KelalSport";
