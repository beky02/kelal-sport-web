import { faydaStartFormSchema } from "@/lib/api/schemas";
import { readForm } from "@/lib/server/body";
import { assertSameOrigin } from "@/lib/server/csrf";
import { startFayda } from "@/lib/server/kyc";
import { respond } from "@/lib/server/respond";
import { readSession, SessionGoneError } from "@/lib/server/session";
import { mockPreference } from "@/lib/server/upstream";

/**
 * Starts Fayda verification for the signed-in player (C02 §8). Without a
 * session nothing is sent: the answer is the session-ended Problem.
 */
export async function POST(request: Request) {
  const refused = assertSameOrigin(request);
  if (refused) return refused;

  const form = await readForm(
    request,
    faydaStartFormSchema,
    "Not a Fayda number",
  );
  if (form instanceof Response) return form;

  return respond(request, (ctx) => {
    const session = readSession(request, ctx.tenant);
    if (!session) throw new SessionGoneError();
    return startFayda(
      { ...ctx, prefer: mockPreference(request.headers.get("prefer")) },
      session,
      form,
    );
  });
}
