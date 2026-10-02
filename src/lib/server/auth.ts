import "server-only";
import type {
  Device,
  LoginForm,
  LoginResult,
  Player,
} from "@/features/auth/types";
import {
  toLoginRequest,
  toOtpRequired,
  toPlayer,
  toPlayerSummary,
} from "@/lib/api/mappers/auth";
import type { components } from "@/lib/api/schema";
import pkg from "../../../package.json";
import {
  apiNow,
  sessionFromTokens,
  withSession,
  type Session,
  type SessionContext,
} from "./session";
import { unwrap, upstream } from "./upstream";

type AuthResult = components["schemas"]["AuthResult"];
type OtpRequired = components["schemas"]["OtpRequired"];

/** This browser, as the contract's `Device`: the server's device cookie and this build. */
export const webDevice = (fingerprint: string): Device => ({
  fingerprint,
  platform: "web",
  appVersion: pkg.version,
});

/**
 * Logs a player in (C01 §6).
 *
 * A 200 is the player plus a session for the route handler to seal into the
 * cookie; a 202 is the new-device challenge, and nothing to store yet. The
 * tokens go no further than `session`.
 */
export async function login(
  ctx: SessionContext,
  form: LoginForm,
  device: Device,
): Promise<{ result: LoginResult; session: Session | null }> {
  const call = await upstream("Auth", ctx).POST("/v1/auth/login", {
    body: toLoginRequest(form, device),
  });
  const data = unwrap(call);
  if (call.response.status === 202 || "otp_required" in data) {
    return { result: toOtpRequired(data as OtpRequired), session: null };
  }
  const auth = data as AuthResult;
  return {
    result: { status: "ok", player: toPlayerSummary(auth.player) },
    session: sessionFromTokens(ctx.tenant, auth.tokens, apiNow(call.response)),
  };
}

/**
 * Revokes the session at the API. Whatever the API answers — gone already,
 * unreachable — the caller clears the cookie: a logout that leaves someone
 * signed in on a shared phone is the one failure this must not have.
 */
export async function logout(
  ctx: SessionContext,
  session: Session,
): Promise<void> {
  try {
    await withSession(
      // The cookie is about to go; a rotation on the way out is not kept.
      { ...ctx, setCookie: () => {} },
      session,
      (authorization) =>
        upstream("Auth", { ...ctx, authorization }).POST("/v1/auth/logout"),
    );
  } catch {
    // Already gone, or unreachable: nothing to revoke that we can reach.
  }
}

/** The signed-in player from `/v1/me`, refreshing the token if it has lapsed. */
export async function loadMe(
  ctx: SessionContext,
  session: Session,
): Promise<Player> {
  const me = await withSession(ctx, session, (authorization) =>
    upstream("Me", { ...ctx, authorization }).GET("/v1/me"),
  );
  return toPlayer(me);
}
