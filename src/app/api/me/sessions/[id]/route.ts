import { API_ID_PATTERN } from "@/lib/api/patterns";
import { revokeDeviceSession } from "@/lib/server/account";
import { assertSameOrigin } from "@/lib/server/csrf";
import { problemResponse, respond } from "@/lib/server/respond";
import { readSession, SessionGoneError } from "@/lib/server/session";
import { mockPreference } from "@/lib/server/upstream";

/**
 * Signs one of the player's devices out (`DELETE /v1/me/sessions/{id}`,
 * AC-9). This site's own page only (origin and CSRF header; a DELETE has no
 * body to check), an id that can be one — it goes into the upstream path —
 * and a session. Answers 204, or the API's Problem unchanged (404 for a
 * device that isn't the player's, or is already signed out).
 */
export async function DELETE(
  request: Request,
  ctx: RouteContext<"/api/me/sessions/[id]">,
) {
  const refused = assertSameOrigin(request, { json: false });
  if (refused) return refused;

  const { id } = await ctx.params;
  if (!API_ID_PATTERN.test(id)) {
    return problemResponse(404, "NOT_FOUND", "No such device");
  }
  return respond(
    request,
    async (route) => {
      const session = readSession(request, route.tenant);
      if (!session) throw new SessionGoneError();
      await revokeDeviceSession(
        { ...route, prefer: mockPreference(request.headers.get("prefer")) },
        session,
        id,
      );
    },
    { status: 204 },
  );
}
