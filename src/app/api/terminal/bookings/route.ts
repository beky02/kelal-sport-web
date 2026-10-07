import { z } from "zod";
import { bookingRequestSchema } from "@/lib/api/booking-schemas";
import { BODY_CAPS, readJson } from "@/lib/server/body";
import { createBooking } from "@/lib/server/bookings";
import { assertSameOrigin } from "@/lib/server/csrf";
import { problemResponse, respond } from "@/lib/server/respond";
import { activeTerminal } from "@/lib/server/terminal";

const idempotencyKeySchema = z.uuid();
const NO_STORE = () => new Headers({ "Cache-Control": "no-store" });

/**
 * Book bet on the kiosk (F8ca, the user's third review): the kiosk's slip
 * saved as a booking code, as the player's guest slip is, for an activated
 * terminal only. The player's checks, in the player's order — this site's
 * own page, one `Idempotency-Key` per intent, a bounded strict body — and
 * then the player's loader, anonymously (`createBooking` allows it), with no
 * `Prefer`.
 */
export async function POST(request: Request) {
  const terminal = activeTerminal(request);
  if (terminal instanceof Response) return terminal;
  const refused = assertSameOrigin(request);
  if (refused) return refused;

  const key = idempotencyKeySchema.safeParse(
    request.headers.get("idempotency-key"),
  );
  if (!key.success) {
    return problemResponse(
      400,
      "VALIDATION_FAILED",
      "Idempotency-Key required",
      NO_STORE(),
    );
  }
  const json = await readJson(request, BODY_CAPS.slip);
  if (json === "too_large") {
    return problemResponse(413, "VALIDATION_FAILED", "Too large", NO_STORE());
  }
  const body = bookingRequestSchema.safeParse(json);
  if (!body.success) {
    return problemResponse(
      422,
      "VALIDATION_FAILED",
      "Not a booking request",
      NO_STORE(),
    );
  }
  return respond(
    request,
    ({ tenant }) => createBooking(tenant, body.data, key.data),
    { status: 201 },
  );
}
