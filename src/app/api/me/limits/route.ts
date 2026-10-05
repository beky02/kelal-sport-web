import { limitChangeSchema } from "@/lib/api/schemas";
import { readForm } from "@/lib/server/body";
import { assertSameOrigin } from "@/lib/server/csrf";
import { respond } from "@/lib/server/respond";
import { changeLimit, loadLimits } from "@/lib/server/responsible-gambling";
import { readSession, SessionGoneError } from "@/lib/server/session";
import { mockPreference } from "@/lib/server/upstream";

/**
 * The player's limits (`GET /v1/me/limits`), never cached: read from the
 * account every time, so a limit set on another device is the one shown
 * (AC-1). Read-only, so no CSRF check (as `/api/wallet`); a session for this
 * tenant is required.
 */
export function GET(request: Request) {
  return respond(request, (ctx) => {
    const session = readSession(request, ctx.tenant);
    if (!session) throw new SessionGoneError();
    return loadLimits(
      { ...ctx, prefer: mockPreference(request.headers.get("prefer")) },
      session,
    );
  });
}

/**
 * Sets or changes one limit (`PUT /v1/me/limits`). Every check runs before
 * anything is sent upstream: this site's own page (origin, CSRF header,
 * JSON), a small body the contract allows — a money limit above zero or a
 * time limit in whole minutes, nothing else — and a session. Answers with the
 * API's limit: in force at once, or with the change it holds back (AC-5).
 */
export async function PUT(request: Request) {
  const refused = assertSameOrigin(request);
  if (refused) return refused;

  const change = await readForm(request, limitChangeSchema, "Not a limit");
  if (change instanceof Response) return change;

  return respond(request, (ctx) => {
    const session = readSession(request, ctx.tenant);
    if (!session) throw new SessionGoneError();
    return changeLimit(
      { ...ctx, prefer: mockPreference(request.headers.get("prefer")) },
      session,
      change,
    );
  });
}
