import "server-only";
import {
  CLOCK_SKEW,
  CLOCK_TOLERANCE_MS,
  DEVICE_SIGNATURE,
  DEVICE_TIMESTAMP,
  TERMINAL_CALLS,
} from "@/features/terminal/lib/calls";
import type {
  BoardSection,
  EventDetail,
  EventFilters,
  SportEvent,
} from "@/features/events/types";
import type { SearchResults } from "@/features/search/types";
import type {
  ActivationForm,
  TerminalActivation,
  TerminalStatus,
} from "@/features/terminal/types";
import {
  toActivateRequest,
  toTerminalActivation,
  toTerminalInfo,
} from "@/lib/api/mappers/terminal";
import pkg from "../../../package.json";
import { isTerminalHost, requestHost, tenantFromHeaders } from "./config";
import { problemResponse } from "./respond";
import { apiNow } from "./session";
import { readTerminalSession, type TerminalSession } from "./terminal-session";
import { unwrap, upstream, type RequestContext } from "./upstream";

/** Rotate when fewer than this remain (`rotateTerminalToken`'s summary). */
const ROTATE_AHEAD_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The terminal's handlers answer only on a terminal host (09-security, the
 * host split). The proxy already keeps them there; this holds even for a
 * request that skips it (CVE-2025-29927). Returns the refusal, or null.
 */
export function terminalOnly(request: Request): Response | null {
  return isTerminalHost(requestHost(request.headers))
    ? null
    : problemResponse(
        404,
        "NOT_FOUND",
        "Not found",
        // Never cached: a cache keyed on the path alone must not hand one
        // host's 404 to the other's (review SEC2).
        new Headers({ "Cache-Control": "no-store" }),
      );
}

/**
 * The kiosk's reads (F8ca) answer only an activated terminal of this tenant,
 * on a terminal host: its sealed cookie, unexpired. Not because the catalogue
 * is secret — it is public, and read anonymously (F8ca decision 2) — but so a
 * terminal host serves its own terminals and nothing else (C19 §12). Returns
 * the session, or the refusal to send before anything is read or called. A
 * 401 makes the kiosk read its status again, which says what it is now.
 *
 * It checks the cookie, not the terminal: a revoked terminal whose cookie has
 * not lapsed still reads the (public) catalogue here. Revocation reaches the
 * kiosk through its 5-minute status read (F8b), and these reads through the
 * API once they are signed (contract request 015) — review SEC1.
 */
export function activeTerminal(request: Request): TerminalSession | Response {
  const elsewhere = terminalOnly(request);
  if (elsewhere) return elsewhere;
  const session = readTerminalSession(
    request,
    tenantFromHeaders(request.headers),
  );
  if (!session || session.expiresAt <= Date.now()) {
    return problemResponse(
      401,
      "AUTH_INVALID_CREDENTIALS",
      "This terminal is not activated",
      new Headers({ "Cache-Control": "no-store" }),
    );
  }
  return session;
}

/** The two headers the browser signs a call with (D3); the route adds the device id. */
export interface DeviceSignature {
  timestamp: number;
  signature: string;
}

/** Unix milliseconds as the browser writes `Date.now()`: 13 digits (until 2286). */
const TIMESTAMP = /^\d{13}$/;
/**
 * Base64 of a P-256 signature: WebCrypto's 64 bytes, or DER's 70–72 should
 * contract request 014 choose it. Anything else never goes upstream.
 */
const SIGNATURE = /^[A-Za-z0-9+/]{40,120}={0,2}$/;

/** A Problem in the API's own shape, with its `errors[]` (the fix, when there is one). */
export const refusal = (
  title: string,
  errors?: { field: string; code: string; current?: string }[],
) =>
  Response.json(
    {
      type: "about:blank",
      title,
      status: 400,
      code: "VALIDATION_FAILED",
      ...(errors ? { errors } : {}),
    },
    {
      status: 400,
      headers: {
        "Content-Type": "application/problem+json",
        "Cache-Control": "no-store",
      },
    },
  );

/**
 * The signed call's device headers, checked before anything goes upstream:
 * a 400 when either is missing or malformed. A timestamp further than
 * `CLOCK_TOLERANCE_MS` from this server's clock gets this server's time back
 * (`errors[0].current`, code `CLOCK_SKEW`), so a shop PC with a wrong clock
 * corrects itself and signs again, rather than every call being refused — or
 * the terminal shown as revoked.
 */
export function deviceSignature(
  request: Request,
  now: number = Date.now(),
): DeviceSignature | Response {
  const timestamp = request.headers.get(DEVICE_TIMESTAMP)?.trim() ?? "";
  const signature = request.headers.get(DEVICE_SIGNATURE)?.trim() ?? "";
  if (!TIMESTAMP.test(timestamp) || !SIGNATURE.test(signature)) {
    return refusal("This request is not signed by the terminal");
  }
  const at = Number(timestamp);
  if (Math.abs(at - now) > CLOCK_TOLERANCE_MS) {
    return refusal("This terminal's clock is wrong", [
      { field: DEVICE_TIMESTAMP, code: CLOCK_SKEW, current: String(now) },
    ]);
  }
  return { timestamp: at, signature };
}

/** The headers a signed terminal call carries upstream (D3). */
const deviceHeaders = (session: TerminalSession, device: DeviceSignature) => ({
  "X-Device-Id": session.terminalId,
  "X-Device-Timestamp": device.timestamp,
  "X-Device-Signature": device.signature,
});

/** A client that calls as this terminal: its token, the tenant, the language. */
const asTerminal = (ctx: RequestContext, session: TerminalSession) =>
  upstream("Retail - terminal", {
    ...ctx,
    authorization: `Bearer ${session.token}`,
  });

const codeOf = (error: unknown): string | undefined =>
  typeof error === "object" && error !== null
    ? ((error as { code?: unknown }).code as string | undefined)
    : undefined;

/**
 * Activates this PC with its one-time code (C19 §4.1). The answer's token
 * goes into `session` for the route handler to seal, and nowhere else.
 */
export async function activateTerminal(
  ctx: RequestContext,
  form: ActivationForm,
): Promise<{ result: TerminalActivation; session: TerminalSession }> {
  const call = await upstream("Retail - terminal", ctx).POST(
    TERMINAL_CALLS.activate.api,
    { body: toActivateRequest(form, pkg.version) },
  );
  const activation = unwrap(call);
  return {
    result: toTerminalActivation(activation),
    session: {
      tenant: ctx.tenant,
      terminalId: activation.terminal_id,
      token: activation.access_token,
      expiresAt: apiNow(call.response) + activation.expires_in * 1000,
    },
  };
}

/**
 * What the terminal is now (`GET /v1/retail/terminal`), and whether its cookie
 * must go.
 *
 * Revoked — `status: revoked`, or a token the API no longer accepts
 * (`AUTH_INVALID_CREDENTIALS`: revoking "logs it out on its next request",
 * C19 §4.1) — and `RETAIL_DEVICE_NOT_ALLOWED` are blocked; an expired token
 * is lapsed: the PC needs a new code. The cookie stays in every case, so every
 * read asks again and is told the same — the state is the server's, and the
 * technician still sees why at the next read (review S1). A new activation
 * replaces it. Any other failure passes through as the API's Problem.
 */
export async function loadTerminalStatus(
  ctx: RequestContext,
  session: TerminalSession,
  device: DeviceSignature,
  now: number = Date.now(),
): Promise<TerminalStatus> {
  const call = await asTerminal(ctx, session).GET(TERMINAL_CALLS.status.api, {
    params: { header: deviceHeaders(session, device) },
  });
  const code = codeOf(call.error);
  if (call.response.status === 401) {
    return code === "AUTH_TOKEN_EXPIRED"
      ? { state: "inactive", reason: "expired" }
      : { state: "blocked", reason: "revoked" };
  }
  if (call.response.status === 403 && code === "RETAIL_DEVICE_NOT_ALLOWED") {
    return { state: "blocked", reason: "device_not_allowed" };
  }
  const self = unwrap(call);
  if (self.status === "revoked") {
    return { state: "blocked", reason: "revoked" };
  }
  return {
    state: "active",
    terminal: toTerminalInfo(self),
    rotateDue: session.expiresAt - now < ROTATE_AHEAD_MS,
  };
}

/**
 * Replaces the terminal token (`POST /v1/retail/terminal/token`), signed by
 * the browser over no body. The old token stays valid five minutes at the API,
 * so calls already on their way still land. A refusal passes through, and the
 * cookie stays: the next status read says what the terminal is.
 */
export async function rotateTerminalToken(
  ctx: RequestContext,
  session: TerminalSession,
  device: DeviceSignature,
): Promise<TerminalSession> {
  const call = await asTerminal(ctx, session).POST(TERMINAL_CALLS.token.api, {
    params: { header: deviceHeaders(session, device) },
  });
  const rotated = unwrap(call);
  return {
    ...session,
    token: rotated.access_token,
    expiresAt: apiNow(call.response) + rotated.expires_in * 1000,
  };
}

/**
 * A sport id as the kiosk asks for one: `s_` and an opaque rest (D3: clients
 * never parse ids), of URL-safe characters (review S4). The contract gives the
 * parameter no pattern; this guard keeps anything else from an upstream URL.
 */
const SPORT = /^s_[A-Za-z0-9_.-]{1,64}$/;
/**
 * A competition or a match: an opaque id (D3) of URL-safe characters — and not
 * dots alone, which a path would read as `.` or `..` (review SEC1).
 */
const ID = /^(?!\.+$)[A-Za-z0-9_.:-]{1,64}$/;
/** A search, as the contract takes it: 2 to 50 characters (`GET /v1/search`, D5). */
const SEARCH_MIN = 2;
const SEARCH_MAX = 50;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** A plain parameter name, safe to name back in `errors[].field`. */
const NAME = /^[a-z_]{1,32}$/;
const FILTERS = [
  "top",
  "upcoming",
  "today",
] as const satisfies readonly NonNullable<EventFilters["filter"]>[];
type BoardFilter = (typeof FILTERS)[number];

/**
 * What the kiosk may ask its board for: a sport, and optionally a day, an
 * order and a competition (its page, F8ca review).
 */
const KNOWN = new Set(["sport", "date", "filter", "competition"]);

/** A day that exists: `2026-02-30` has the shape and not the day (review SEC3). */
function isDay(date: string): boolean {
  const parts = DATE.exec(date);
  if (!parts) return false;
  const [year, month, day] = parts.slice(1).map(Number);
  const at = new Date(Date.UTC(year, month - 1, day));
  return (
    at.getUTCFullYear() === year &&
    at.getUTCMonth() === month - 1 &&
    at.getUTCDate() === day
  );
}

/**
 * The kiosk board's query (F8ca), checked whole before anything goes
 * upstream: a sport, a day and an order (no live board, D8; no competition,
 * no data saver), each once. Anything else is the field it got wrong — named
 * back only when it is a plain name, else `query`.
 */
export function boardQuery(
  params: URLSearchParams,
): EventFilters | { field: string; code: string } {
  for (const key of params.keys()) {
    if (!KNOWN.has(key)) {
      return { field: NAME.test(key) ? key : "query", code: "UNKNOWN" };
    }
    if (params.getAll(key).length > 1) return { field: key, code: "FORMAT" };
  }
  const sport = params.get("sport") ?? "";
  if (!SPORT.test(sport)) return { field: "sport", code: "FORMAT" };
  const date = params.get("date");
  if (date !== null && !isDay(date)) return { field: "date", code: "FORMAT" };
  const filter = params.get("filter");
  if (filter !== null && !FILTERS.includes(filter as BoardFilter)) {
    return { field: "filter", code: "FORMAT" };
  }
  const competition = params.get("competition");
  if (competition !== null && !ID.test(competition)) {
    return { field: "competition", code: "FORMAT" };
  }
  return {
    sportId: sport,
    competitionId: competition ?? undefined,
    date: date ?? undefined,
    filter: (filter as BoardFilter | null) ?? undefined,
  };
}

/** The first parameter that isn't one of `known`, or one given twice. */
function strayParameter(
  params: URLSearchParams,
  known: ReadonlySet<string>,
): { field: string; code: string } | null {
  for (const key of params.keys()) {
    if (!known.has(key)) {
      return { field: NAME.test(key) ? key : "query", code: "UNKNOWN" };
    }
    if (params.getAll(key).length > 1) return { field: key, code: "FORMAT" };
  }
  return null;
}

/** A match's id from its route, checked before it is put in an upstream path. */
export function eventQuery(
  id: string,
  params: URLSearchParams,
): { id: string } | { field: string; code: string } {
  return (
    strayParameter(params, new Set()) ??
    (ID.test(id) ? { id } : { field: "id", code: "FORMAT" })
  );
}

/**
 * A search, trimmed. Too long, or anything beside it, is refused; under the
 * contract's two characters it asks nothing (`q` empty).
 */
export function searchQuery(
  params: URLSearchParams,
): { q: string } | { field: string; code: string } {
  const stray = strayParameter(params, new Set(["q"]));
  if (stray) return stray;
  const q = (params.get("q") ?? "").trim();
  if (q.length > SEARCH_MAX) return { field: "q", code: "MAX" };
  return { q: q.length < SEARCH_MIN ? "" : q };
}

/** Before kick-off: what a shop sells (D8). */
const beforeKickOff = (event: SportEvent) =>
  event.status === "scheduled" || event.status === "starting_soon";

/**
 * The board a shop sells from: matches before kick-off only (D8: no in-play
 * betting in Release 1, and the kiosk has no live board). An in-play or ended
 * match — which only the simulated board lists today — is left off, and so is
 * a competition left with nothing (review U3).
 */
export function preMatchBoard(sections: BoardSection[]): BoardSection[] {
  return sections
    .map((section) => {
      const events = section.events.filter((row) => beforeKickOff(row.event));
      return events.length === section.events.length
        ? section
        : { ...section, events };
    })
    .filter((section) => section.events.length > 0);
}

/** A match's book on the kiosk: only before kick-off; otherwise there is none to show. */
export const preMatchEvent = (
  detail: EventDetail | null,
): EventDetail | null =>
  detail && beforeKickOff(detail.event) ? detail : null;

/** Search results on the kiosk: matches before kick-off only. */
export const preMatchSearch = (results: SearchResults): SearchResults => ({
  ...results,
  events: results.events.filter((row) => beforeKickOff(row.event)),
});
