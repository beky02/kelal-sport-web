import { logout } from "@/lib/server/auth";
import { assertSameOrigin } from "@/lib/server/csrf";
import { respond } from "@/lib/server/respond";
import { clearSessionCookie, readSession } from "@/lib/server/session";

/** Ends the session: revoked at the API when it can be, cleared here always. */
export async function POST(request: Request) {
  const refused = assertSameOrigin(request);
  if (refused) return refused;

  return respond(
    request,
    async (ctx) => {
      const session = readSession(request, ctx.tenant);
      if (session) await logout(ctx, session);
      ctx.setCookie(clearSessionCookie(request));
    },
    { status: 204 },
  );
}
