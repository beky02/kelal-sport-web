import { registerFormSchema } from "@/lib/api/schemas";
import { logout, register, webDevice } from "@/lib/server/auth";
import { readForm } from "@/lib/server/body";
import { assertSameOrigin } from "@/lib/server/csrf";
import { respond } from "@/lib/server/respond";
import { ensureDevice, readSession, sessionCookie } from "@/lib/server/session";
import { mockPreference } from "@/lib/server/upstream";

/**
 * Creates the account and signs the new player in. As with login, the API's
 * tokens end up sealed in the session cookie and nowhere else; the browser
 * gets who was created (AC-1). A session the browser already had is revoked
 * at the API (best effort) before the new cookie replaces it — on a shared
 * phone it must not live on, unseen, for thirty days.
 */
export async function POST(request: Request) {
  const refused = assertSameOrigin(request);
  if (refused) return refused;

  const form = await readForm(
    request,
    registerFormSchema,
    "Not a registration",
  );
  if (form instanceof Response) return form;

  return respond(
    request,
    async (ctx) => {
      const device = webDevice(ensureDevice(request, ctx.setCookie));
      const previous = readSession(request, ctx.tenant);
      const { result, session } = await register(
        { ...ctx, prefer: mockPreference(request.headers.get("prefer")) },
        form,
        device,
      );
      // Only once the new account exists: a refused registration keeps the
      // player who was signed in.
      if (previous) await logout(ctx, previous);
      ctx.setCookie(sessionCookie(session, request));
      return result;
    },
    { status: 201 },
  );
}
