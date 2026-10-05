import { selfExclusionRequestSchema } from "@/lib/api/schemas";
import { readForm } from "@/lib/server/body";
import { assertSameOrigin } from "@/lib/server/csrf";
import { respond } from "@/lib/server/respond";
import { selfExclude } from "@/lib/server/responsible-gambling";
import {
  clearSessionCookie,
  readSession,
  SessionGoneError,
} from "@/lib/server/session";
import { mockPreference } from "@/lib/server/upstream";

/**
 * Takes a break or self-excludes (`POST /v1/me/self-exclusion`). Every check
 * runs before anything is sent upstream: this site's own page (origin, CSRF
 * header, JSON), one of the contract's kinds and durations and nothing else,
 * and a session. The API revokes every session of the player as it answers,
 * so a 201 also clears this one's cookie: the player leaves signed out, and
 * nothing in the browser can bring the session back (AC-6). A refusal keeps
 * the session — no break started.
 */
export async function POST(request: Request) {
  const refused = assertSameOrigin(request);
  if (refused) return refused;

  const exclusion = await readForm(
    request,
    selfExclusionRequestSchema,
    "Not a break",
  );
  if (exclusion instanceof Response) return exclusion;

  return respond(
    request,
    async (ctx) => {
      const session = readSession(request, ctx.tenant);
      if (!session) throw new SessionGoneError();
      const started = await selfExclude(
        { ...ctx, prefer: mockPreference(request.headers.get("prefer")) },
        session,
        exclusion,
      );
      ctx.setCookie(clearSessionCookie(request));
      return started;
    },
    { status: 201 },
  );
}
