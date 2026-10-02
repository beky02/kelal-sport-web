import { z } from "zod";
import { bookingRequestSchema } from "@/lib/api/schemas";
import { readJson } from "@/lib/server/body";
import { createBooking } from "@/lib/server/bookings";
import { assertSameOrigin } from "@/lib/server/csrf";
import { problemResponse, respond } from "@/lib/server/respond";
import { mockPreference } from "@/lib/server/upstream";

const idempotencyKeySchema = z.uuid();

/** Far more than any slip (30 legs) needs; nothing bigger is read. */
const MAX_BODY_BYTES = 16 * 1024;

export async function POST(request: Request) {
  // Only this site's own pages book (C18 §4.4): origin, CSRF header, JSON.
  const refused = assertSameOrigin(request);
  if (refused) return refused;

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

  const json = await readJson(request, MAX_BODY_BYTES);
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
