import { z } from "zod";
import { ApiError, ContractError, problemError } from "@/lib/api/errors";
import { CSRF_HEADER, CSRF_VALUE } from "@/lib/session-cookie";
import { CLOCK_SKEW, DEVICE_TIMESTAMP, type TerminalCall } from "../lib/calls";
import { signRequest } from "../lib/signing";

/**
 * The terminal's language for the API's own words (Problem titles), until F8c
 * gives the kiosk a choice: Amharic, the `demo` tenant's default (FD2). The
 * screens themselves show both languages.
 */
const TERMINAL_LANG = "am";

/**
 * How far this PC's clock is from the server's, learnt from a `CLOCK_SKEW`
 * answer. Kept for the page's life, so every later call is signed on time.
 */
let clockOffsetMs = 0;

/** Forget the learnt offset (a new page load does the same). */
export const resetTerminalClock = () => {
  clockOffsetMs = 0;
};

/** The server's time, as near as this PC knows it. */
const serverNow = () => Date.now() + clockOffsetMs;

/**
 * The server's time from a `CLOCK_SKEW` refusal (`errors[].current`), or null
 * when the refusal is anything else.
 */
function serverTimeIn(error: ApiError): number | null {
  if (error.code !== "VALIDATION_FAILED") return null;
  const fix = error.errors.find(
    (entry) => entry.field === DEVICE_TIMESTAMP && entry.code === CLOCK_SKEW,
  );
  const current = Number(fix?.current);
  return fix?.current && Number.isSafeInteger(current) ? current : null;
}

/**
 * The terminal's one way to talk HTTP: to this app's `/api/terminal/*` route
 * handlers only (D3), which hold the terminal token in their cookie.
 *
 * A signed call is signed here with the device key, for the API call the
 * route will make (`call.method`, `call.api`) over the exact body sent. If the
 * route answers that this PC's clock is off, the offset is learnt from the
 * server's time in the answer and the call signed again — once. Every answer
 * is checked against `schema` before it reaches a hook.
 */
export async function terminalRequest<T>(
  call: TerminalCall,
  schema: z.ZodType<T>,
  {
    body,
    key,
    signal,
  }: { body?: unknown; key?: CryptoKey; signal?: AbortSignal } = {},
): Promise<T> {
  const text = body === undefined ? undefined : JSON.stringify(body);
  if (call.signed && !key) {
    throw new ApiError("No device key to sign with", 0, "device_key_missing");
  }

  for (let attempt = 0; ; attempt += 1) {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Accept-Language": TERMINAL_LANG,
      ...(text !== undefined ? { "Content-Type": "application/json" } : {}),
      // Every call that changes something carries the header the route
      // handlers insist on (09-security, CSRF).
      ...(call.method !== "GET" ? { [CSRF_HEADER]: CSRF_VALUE } : {}),
      ...(call.signed && key
        ? await signRequest(key, call, { body: text ?? "", now: serverNow() })
        : {}),
    };

    let response: Response;
    try {
      response = await fetch(call.route, {
        method: call.method,
        headers,
        body: text,
        signal,
      });
    } catch (cause) {
      throw new ApiError(
        cause instanceof Error ? cause.message : "Network request failed",
        0,
        "network",
        cause,
      );
    }

    if (!response.ok) {
      const error = await problemError(
        response,
        `${call.method} ${call.route}`,
      );
      const serverTime = call.signed ? serverTimeIn(error) : null;
      if (serverTime !== null && attempt === 0) {
        clockOffsetMs = serverTime - Date.now();
        continue;
      }
      throw error;
    }

    const parsed = schema.safeParse(await response.json());
    if (!parsed.success) {
      throw new ContractError(call.route, z.prettifyError(parsed.error));
    }
    return parsed.data;
  }
}
