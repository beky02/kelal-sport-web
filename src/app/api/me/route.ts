import { loadMe } from "@/lib/server/auth";
import { respond } from "@/lib/server/respond";
import { readSession, SessionGoneError } from "@/lib/server/session";
import { mockPreference } from "@/lib/server/upstream";

/**
 * Who is signed in, from the API — never from anything the browser keeps
 * (AC-8). A guest is `{ player: null }`, a state rather than an error; a
 * session the API no longer honours is cleared on the way out.
 */
export function GET(request: Request) {
  return respond(request, async (ctx) => {
    const session = readSession(request, ctx.tenant);
    if (!session) return { player: null };
    try {
      return {
        player: await loadMe(
          { ...ctx, prefer: mockPreference(request.headers.get("prefer")) },
          session,
        ),
      };
    } catch (error) {
      if (error instanceof SessionGoneError) return { player: null };
      throw error;
    }
  });
}
