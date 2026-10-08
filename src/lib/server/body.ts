import "server-only";
import type { z } from "zod";
import { problemResponse } from "./respond";

/**
 * Every size a handler may read a body up to, and no other: `maxBytes` takes
 * only these values (literal types, so `64 * 1024` does not type-check). The
 * proxy holds each body before the handler runs, and next.config.ts's
 * `proxyClientMaxBodySize` must stay above the largest of these, or a body a
 * handler accepts would arrive cut (F8a decision 9, tests/unit/proxy.test.ts).
 */
export const BODY_CAPS = {
  /** 4 KiB: a form, a code, a login — a phone, a password, a six-digit code. */
  form: 4_096,
  /** 16 KiB: far more than any slip (30 legs) needs — bets and bookings. */
  slip: 16_384,
} as const;

export type BodyCap = (typeof BODY_CAPS)[keyof typeof BODY_CAPS];

/**
 * The request body's bytes — `null` when there is none, `"too_large"` over
 * `maxBytes` — without ever holding more than that, whatever
 * `Content-Length` claims.
 */
async function readBytes(
  request: Request,
  maxBytes: BodyCap,
): Promise<Buffer | null | "too_large"> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) return "too_large";
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return "too_large";
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/**
 * The request body as JSON, `null` when it is not JSON, or `"too_large"` —
 * without ever holding more than `maxBytes`, whatever `Content-Length` claims.
 */
export async function readJson(
  request: Request,
  maxBytes: BodyCap,
): Promise<unknown | "too_large"> {
  const bytes = await readBytes(request, maxBytes);
  if (bytes === null || bytes === "too_large") return bytes;
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

/**
 * The request body as the exact text sent, for a body that goes on byte for
 * byte (a terminal's signed call, F8cc): `null` when there is none or it is
 * not UTF-8 — nothing is replaced, and a byte-order mark stays (and then is
 * no JSON) — or `"too_large"` over `maxBytes`.
 */
export async function readText(
  request: Request,
  maxBytes: BodyCap,
): Promise<string | null | "too_large"> {
  const bytes = await readBytes(request, maxBytes);
  if (bytes === null || bytes === "too_large") return bytes;
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
  } catch {
    return null;
  }
}

/**
 * The request's JSON body checked against `schema`, or the Problem to answer
 * instead: 413 when it is over `maxBytes` (a form's 4 KiB unless the route
 * says more), 422 when it is not what `schema` accepts. Nothing is sent
 * upstream before this has passed.
 */
export async function readForm<T>(
  request: Request,
  schema: z.ZodType<T>,
  refusal: string,
  maxBytes: BodyCap = BODY_CAPS.form,
): Promise<T | Response> {
  const json = await readJson(request, maxBytes);
  if (json === "too_large") {
    return problemResponse(413, "VALIDATION_FAILED", "Too large");
  }
  const form = schema.safeParse(json);
  return form.success
    ? form.data
    : problemResponse(422, "VALIDATION_FAILED", refusal);
}
