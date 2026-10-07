import { normaliseBookingCode } from "@/features/bookings/lib/code";
import { loadBooking } from "@/lib/server/bookings";
import { activeTerminal } from "@/lib/server/terminal";
import { problemResponse, respond } from "@/lib/server/respond";

/** Load and re-price a shared code on an activated terminal (F8ca rework 2). */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/terminal/bookings/[code]">,
) {
  const terminal = activeTerminal(request);
  if (terminal instanceof Response) return terminal;

  const code = normaliseBookingCode((await ctx.params).code);
  if (!code) {
    return problemResponse(
      422,
      "VALIDATION_FAILED",
      "Not a booking code",
      new Headers({ "Cache-Control": "no-store" }),
    );
  }
  return respond(request, ({ tenant }) => loadBooking(tenant, code));
}
