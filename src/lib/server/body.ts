import "server-only";
import type { z } from "zod";
import { problemResponse } from "./respond";

/**
 * The request body as JSON, `null` when it is not JSON, or `"too_large"` —
 * without ever holding more than `maxBytes`, whatever `Content-Length` claims.
 */
export async function readJson(
  request: Request,
  maxBytes: number,
): Promise<unknown | "too_large"> {
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
  try {
    return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)));
  } catch {
    return null;
  }
}

/** A JSON body small enough to hold — a form, a code — and nothing bigger. */
const FORM_MAX_BYTES = 4 * 1024;

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
  maxBytes: number = FORM_MAX_BYTES,
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
