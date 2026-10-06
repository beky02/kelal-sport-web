import { z } from "zod";
import { ApiError, ContractError, problemError } from "@/lib/api/errors";
import { CSRF_HEADER, CSRF_VALUE } from "@/lib/session-cookie";
import {
  CLOCK_SKEW,
  DEVICE_TIMESTAMP,
  type TerminalCall,
  type TerminalRead,
} from "../lib/calls";
import { signRequest } from "../lib/signing";
import type { Lang } from "@/types/common";

/**
 * The language the terminal's own calls (activation, status, rotation) ask
 * in: English, the terminal's first language (F8ca rework 2). Their answers
 * are states, shown in both languages; the kiosk's reads ask in the kiosk's
 * language (`terminalRead`).
 */
const TERMINAL_LANG: Lang = "en";

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

    const response = await send(call.route, {
      method: call.method,
      headers,
      body: text,
      signal,
    });

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

    return parse(response, call.route, schema);
  }
}

/** `fetch`, with a failure to reach the route as an `ApiError` (status 0). */
async function send(route: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(route, init);
  } catch (cause) {
    throw new ApiError(
      cause instanceof Error ? cause.message : "Network request failed",
      0,
      "network",
      cause,
    );
  }
}

/** A route's answer, checked against its schema before it reaches a hook. */
async function parse<T>(
  response: Response,
  route: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) {
    throw new ContractError(route, z.prettifyError(parsed.error));
  }
  return parsed.data;
}

/**
 * One of the kiosk's reads (F8ca): an unsigned GET of this app's route, with
 * its query, asking in `lang` — the kiosk's language, for the API's own words
 * (Problem titles); the names come back in both. Problems become `ApiError`s
 * and every answer is checked against `schema`, as for the signed calls.
 */
export async function terminalRead<T>(
  route: TerminalRead,
  schema: z.ZodType<T>,
  {
    lang,
    params,
    signal,
  }: { lang: Lang; params?: Record<string, string>; signal?: AbortSignal },
): Promise<T> {
  const query = new URLSearchParams(params).toString();
  const url = query ? `${route}?${query}` : route;
  const response = await send(url, {
    method: "GET",
    headers: { Accept: "application/json", "Accept-Language": lang },
    signal,
  });
  if (!response.ok) throw await problemError(response, `GET ${route}`);
  return parse(response, route, schema);
}
