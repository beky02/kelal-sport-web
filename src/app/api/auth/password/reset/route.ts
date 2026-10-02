import { passwordResetFormSchema } from "@/lib/api/schemas";
import { resetPassword } from "@/lib/server/auth";
import { readForm } from "@/lib/server/body";
import { assertSameOrigin } from "@/lib/server/csrf";
import { respond } from "@/lib/server/respond";
import { mockPreference } from "@/lib/server/upstream";

/** Sets a new password with the reset code (REG-09). Signs nobody in. */
export async function POST(request: Request) {
  const refused = assertSameOrigin(request);
  if (refused) return refused;

  const form = await readForm(
    request,
    passwordResetFormSchema,
    "Not a password reset",
  );
  if (form instanceof Response) return form;

  return respond(
    request,
    (ctx) =>
      resetPassword(
        { ...ctx, prefer: mockPreference(request.headers.get("prefer")) },
        form,
      ),
    { status: 204 },
  );
}
