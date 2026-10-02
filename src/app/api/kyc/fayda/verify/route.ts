import { faydaVerifyFormSchema } from "@/lib/api/schemas";
import { readForm } from "@/lib/server/body";
import { assertSameOrigin } from "@/lib/server/csrf";
import { verifyFayda } from "@/lib/server/kyc";
import { respond } from "@/lib/server/respond";
import { readSession, SessionGoneError } from "@/lib/server/session";
import { mockPreference } from "@/lib/server/upstream";

/** Completes Fayda verification with Fayda's code; answers the verdict (AC-10). */
export async function POST(request: Request) {
  const refused = assertSameOrigin(request);
  if (refused) return refused;

  const form = await readForm(
    request,
    faydaVerifyFormSchema,
    "Not a Fayda code",
  );
  if (form instanceof Response) return form;

  return respond(request, (ctx) => {
    const session = readSession(request, ctx.tenant);
    if (!session) throw new SessionGoneError();
    return verifyFayda(
      { ...ctx, prefer: mockPreference(request.headers.get("prefer")) },
      session,
      form,
    );
  });
}
