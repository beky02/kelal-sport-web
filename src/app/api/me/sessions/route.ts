import { loadDeviceSessions } from "@/lib/server/account";
import { respond } from "@/lib/server/respond";
import { readSession, SessionGoneError } from "@/lib/server/session";
import { mockPreference } from "@/lib/server/upstream";

/**
 * The devices signed in to the account (`GET /v1/me/sessions`, AC-9), never
 * cached. Read-only, so no CSRF check (as `/api/me/limits`); a session for
 * this tenant is required.
 */
export function GET(request: Request) {
  return respond(request, (ctx) => {
    const session = readSession(request, ctx.tenant);
    if (!session) throw new SessionGoneError();
    return loadDeviceSessions(
      { ...ctx, prefer: mockPreference(request.headers.get("prefer")) },
      session,
    );
  });
}
