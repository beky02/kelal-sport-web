import { loadPaymentMethods } from "@/lib/server/payments";
import { respond } from "@/lib/server/respond";
import { readSession, SessionGoneError } from "@/lib/server/session";
import { mockPreference } from "@/lib/server/upstream";

/**
 * The payment methods offered to this player, with their limits
 * (`GET /v1/payment-methods`), never cached. Read-only, so no CSRF check (as
 * `/api/wallet`); a session for this tenant is required.
 */
export function GET(request: Request) {
  return respond(request, (ctx) => {
    const session = readSession(request, ctx.tenant);
    if (!session) throw new SessionGoneError();
    return loadPaymentMethods(
      { ...ctx, prefer: mockPreference(request.headers.get("prefer")) },
      session,
    );
  });
}
