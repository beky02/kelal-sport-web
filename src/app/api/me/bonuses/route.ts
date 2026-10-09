import { loadMyBonuses } from "@/lib/server/promotions";
import { respond } from "@/lib/server/respond";
import { readSession, SessionGoneError } from "@/lib/server/session";
import { mockPreference } from "@/lib/server/upstream";

/**
 * The player's bonus in progress and free bets (`GET /v1/me/bonuses`, AC-11),
 * never cached. Read-only, so no CSRF check (as `/api/me/limits`); a session
 * for this tenant is required.
 */
export function GET(request: Request) {
  return respond(request, (ctx) => {
    const session = readSession(request, ctx.tenant);
    if (!session) throw new SessionGoneError();
    return loadMyBonuses(
      { ...ctx, prefer: mockPreference(request.headers.get("prefer")) },
      session,
    );
  });
}
