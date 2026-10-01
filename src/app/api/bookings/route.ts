import { z } from "zod";
import { bookingRequestSchema } from "@/lib/api/schemas";
import { createBooking } from "@/lib/server/bookings";
import { problemResponse, respond } from "@/lib/server/respond";
import { mockPreference } from "@/lib/server/upstream";

const idempotencyKeySchema = z.uuid();

export async function POST(request: Request) {
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

  const body = bookingRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
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
