import { normaliseBookingCode } from "@/features/bookings/lib/code";
import { loadBooking } from "@/lib/server/bookings";
import { problemResponse, respond } from "@/lib/server/respond";
import { mockPreference } from "@/lib/server/upstream";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/bookings/[code]">,
) {
  // Checked here as well as in the browser: only a well-formed code ever
  // reaches an upstream path.
  const code = normaliseBookingCode((await ctx.params).code);
  if (!code) {
    return problemResponse(422, "VALIDATION_FAILED", "Not a booking code");
  }
  return respond(request, ({ tenant }) =>
    loadBooking(tenant, code, mockPreference(request.headers.get("prefer"))),
  );
}
