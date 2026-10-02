import { z } from "zod";
import { bookingRequestSchema } from "@/lib/api/schemas";
import { createBooking } from "@/lib/server/bookings";
import { problemResponse, respond } from "@/lib/server/respond";
import { mockPreference } from "@/lib/server/upstream";

const idempotencyKeySchema = z.uuid();

/** Far more than any slip (30 legs) needs; nothing bigger is read. */
const MAX_BODY_BYTES = 16 * 1024;

/** The body as JSON, or null — without ever holding more than the cap. */
async function readJson(request: Request): Promise<unknown | "too_large"> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return "too_large";
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
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

export async function POST(request: Request) {
  // Only this site's own pages book. Browsers say where a request came from;
  // a page on another site gets nothing, whatever CORS later allows.
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return problemResponse(403, "PERMISSION_DENIED", "Not from this site");
  }

  // JSON only: a cross-site HTML form cannot send it without a CORS preflight.
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return problemResponse(415, "VALIDATION_FAILED", "Send JSON");
  }

  // One key per booking intent, made by the browser and reused on retry.
  const key = idempotencyKeySchema.safeParse(
    request.headers.get("idempotency-key"),
  );
  if (!key.success) {
    return problemResponse(
      400,
      "VALIDATION_FAILED",
      "Idempotency-Key required",
    );
  }

  const json = await readJson(request);
  if (json === "too_large") {
    return problemResponse(413, "VALIDATION_FAILED", "Too large");
  }
  const body = bookingRequestSchema.safeParse(json);
  if (!body.success) {
    return problemResponse(422, "VALIDATION_FAILED", "Not a booking request");
  }

  return respond(
    request,
    ({ tenant }) =>
      createBooking(
        tenant,
        body.data,
        key.data,
        mockPreference(request.headers.get("prefer")),
      ),
    { status: 201 },
  );
}
