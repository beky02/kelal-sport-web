import { respond } from "@/lib/server/respond";
import { readSession, SessionGoneError } from "@/lib/server/session";
import { mockPreference } from "@/lib/server/upstream";
import { loadWallet } from "@/lib/server/wallet";

/**
 * The player's balances (`GET /v1/wallet`), never cached. Read-only, so no
 * CSRF check (as `/api/me`); a session for this tenant is required.
 */
export function GET(request: Request) {
  return respond(request, (ctx) => {
    const session = readSession(request, ctx.tenant);
    if (!session) throw new SessionGoneError();
    return loadWallet(
      { ...ctx, prefer: mockPreference(request.headers.get("prefer")) },
      session,
    );
  });
}
