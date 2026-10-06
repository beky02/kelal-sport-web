import { accountChangeSchema } from "@/lib/api/schemas";
import { updateAccount } from "@/lib/server/account";
import { loadMe } from "@/lib/server/auth";
import { readForm } from "@/lib/server/body";
import { assertSameOrigin } from "@/lib/server/csrf";
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

/**
 * Changes the player's language or marketing consent (`PATCH /v1/me`, AC-8).
 * Every check runs before anything is sent upstream: this site's own page
 * (origin, CSRF header, JSON), a body with only those two fields, and a
 * session. Answers in `GET`'s own shape with the account as the API now has
 * it, so the browser's `/api/me` entry becomes the API's answer.
 */
export async function PATCH(request: Request) {
  const refused = assertSameOrigin(request);
  if (refused) return refused;

  const change = await readForm(
    request,
    accountChangeSchema,
    "Not a change to the account",
  );
  if (change instanceof Response) return change;

  return respond(request, async (ctx) => {
    const session = readSession(request, ctx.tenant);
    if (!session) throw new SessionGoneError();
    return {
      player: await updateAccount(
        { ...ctx, prefer: mockPreference(request.headers.get("prefer")) },
        session,
        change,
      ),
    };
  });
}
