import { registerFormSchema } from "@/lib/api/schemas";
import { register, webDevice } from "@/lib/server/auth";
import { readForm } from "@/lib/server/body";
import { assertSameOrigin } from "@/lib/server/csrf";
import { respond } from "@/lib/server/respond";
import { ensureDevice, sessionCookie } from "@/lib/server/session";
import { mockPreference } from "@/lib/server/upstream";

/**
 * Creates the account and signs the new player in. As with login, the API's
 * tokens end up sealed in the session cookie and nowhere else; the browser
 * gets who was created (AC-1).
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
      const { result, session } = await register(
        { ...ctx, prefer: mockPreference(request.headers.get("prefer")) },
        form,
        device,
      );
      ctx.setCookie(sessionCookie(session, request));
      return result;
    },
    { status: 201 },
  );
}
