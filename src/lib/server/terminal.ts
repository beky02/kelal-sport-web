import "server-only";
import {
  CLOCK_SKEW,
  CLOCK_TOLERANCE_MS,
  DEVICE_SIGNATURE,
  DEVICE_TIMESTAMP,
  TERMINAL_CALLS,
} from "@/features/terminal/lib/calls";
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
    : problemResponse(404, "NOT_FOUND", "Not found");
}

/**
 * The kiosk's reads (F8ca) answer only an activated terminal of this tenant,
 * on a terminal host: its sealed cookie, unexpired. Not because the catalogue
 * is secret — it is public, and read anonymously (F8ca decision 2) — but so a
 * terminal host serves its own terminals and nothing else (C19 §12). Returns
 * the session, or the refusal to send before anything is read or called. A
 * 401 makes the kiosk read its status again, which says what it is now.
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
