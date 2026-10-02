import { loginFormSchema } from "@/lib/api/schemas";
import { login, logout, webDevice } from "@/lib/server/auth";
import { readJson } from "@/lib/server/body";
import { assertSameOrigin } from "@/lib/server/csrf";
import { problemResponse, respond } from "@/lib/server/respond";
import { ensureDevice, readSession, sessionCookie } from "@/lib/server/session";
import { mockPreference } from "@/lib/server/upstream";

/** A phone, a password and at most a six-digit code: nothing bigger is read. */
const MAX_BODY_BYTES = 4 * 1024;

/**
 * Logs in. The API's tokens end up sealed in the session cookie and nowhere
 * else; the browser gets the player, or the new-device challenge (AC-3, AC-6).
 */
export async function POST(request: Request) {
  const refused = assertSameOrigin(request);
  if (refused) return refused;

  const json = await readJson(request, MAX_BODY_BYTES);
  if (json === "too_large") {
    return problemResponse(413, "VALIDATION_FAILED", "Too large");
  }
  const form = loginFormSchema.safeParse(json);
  if (!form.success) {
    return problemResponse(422, "VALIDATION_FAILED", "Not a login request");
  }

  return respond(request, async (ctx) => {
    const device = webDevice(ensureDevice(request, ctx.setCookie));
    const previous = readSession(request, ctx.tenant);
    const { result, session } = await login(
      { ...ctx, prefer: mockPreference(request.headers.get("prefer")) },
      form.data,
      device,
    );
    if (session) {
      // A session this browser already had is revoked at the API (best
      // effort) before the new cookie replaces it: on a shared phone it must
      // not live on, unseen, for thirty days. Not on a 202 — nobody is
      // signed in yet — nor on a refusal.
      if (previous) await logout(ctx, previous);
      ctx.setCookie(sessionCookie(session, request));
    }
    return result;
  });
}
