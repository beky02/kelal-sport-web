import { otpRequestFormSchema } from "@/lib/api/schemas";
import { sendOtp } from "@/lib/server/auth";
import { readForm } from "@/lib/server/body";
import { assertSameOrigin } from "@/lib/server/csrf";
import { respond } from "@/lib/server/respond";
import { mockPreference } from "@/lib/server/upstream";

/**
 * Sends an SMS code to register or to reset a password (C01 §6). The answer
 * is the challenge: its id, how long the code lasts, and when another may be
 * asked for.
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

  return respond(request, (ctx) =>
    sendOtp(
      { ...ctx, prefer: mockPreference(request.headers.get("prefer")) },
      form,
    ),
  );
}
