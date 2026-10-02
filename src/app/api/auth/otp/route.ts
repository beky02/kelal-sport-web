import { otpRequestFormSchema } from "@/lib/api/schemas";
import { sendOtp } from "@/lib/server/auth";
import { readForm } from "@/lib/server/body";
import { assertSameOrigin } from "@/lib/server/csrf";
import { respond } from "@/lib/server/respond";
import { ensureDevice } from "@/lib/server/session";
import { mockPreference } from "@/lib/server/upstream";

/**
 * Sends an SMS code to register or to reset a password (C01 §6). The answer
 * is the challenge: its id, how long the code lasts, and when another may be
 * asked for. The device cookie is read or minted here too: it is this
 * browser's identity for the per-device send limits once contract request
 * 004 forwards it, and the same id registration sends as `device`.
 */
export async function POST(request: Request) {
  const refused = assertSameOrigin(request);
  if (refused) return refused;

  const form = await readForm(
    request,
    otpRequestFormSchema,
    "Not a code request",
  );
  if (form instanceof Response) return form;

  return respond(request, (ctx) => {
    ensureDevice(request, ctx.setCookie);
    return sendOtp(
      { ...ctx, prefer: mockPreference(request.headers.get("prefer")) },
      form,
    );
  });
}
