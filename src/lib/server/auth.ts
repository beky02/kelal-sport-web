import "server-only";
import type {
  Device,
  LoginForm,
  LoginResult,
  OtpChallengeView,
  OtpRequestForm,
  PasswordResetForm,
  Player,
  RegisterForm,
  RegisterResult,
} from "@/features/auth/types";
import {
  toLoginRequest,
  toOtpChallenge,
  toOtpRequest,
  toOtpRequired,
  toPasswordResetRequest,
  toPlayer,
  toPlayerSummary,
  toRegisterRequest,
} from "@/lib/api/mappers/auth";
import type { components } from "@/lib/api/schema";
import pkg from "../../../package.json";
import { loadPublicConfig } from "./public-config";
import {
  apiNow,
  sessionFromTokens,
  withSession,
  type Session,
  type SessionContext,
} from "./session";
import { UpstreamError, unwrap, upstream } from "./upstream";

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

// ── registration and reset (F4b) ────────────────────────────────────────────

/**
 * Sends an SMS code (C01 §6). For `reset` the API answers the same whether or
 * not the phone has an account (C01 §10); only `register` says it is taken.
 */
export async function sendOtp(
  ctx: SessionContext,
  form: OtpRequestForm,
): Promise<OtpChallengeView> {
  const call = await upstream("Auth", ctx).POST("/v1/auth/otp", {
    body: toOtpRequest(form),
  });
  return toOtpChallenge(unwrap(call));
}

/**
 * The tenant's current terms version — what the player's tick on the phone
 * step accepts (REG-03). Never taken from the browser. A tenant with none
 * configured cannot record a consent, so nobody registers there until it does.
 */
async function termsVersion(tenant: string): Promise<string> {
  const version = (await loadPublicConfig(tenant)).legal?.terms_version;
  if (version?.trim()) return version;
  throw new UpstreamError(503, {
    type: "about:blank",
    title: "Registration is not available right now",
    status: 503,
    code: "SERVICE_UNAVAILABLE",
  });
}

/**
 * Creates the account (C01 §8). The API checks the SMS code here, not on the
 * code step. A 201 is the new player plus a session for the route handler to
 * seal into the cookie, exactly as a login; the tokens go no further.
 */
export async function register(
  ctx: SessionContext,
  form: RegisterForm,
  device: Device,
): Promise<{ result: RegisterResult; session: Session }> {
  const terms = await termsVersion(ctx.tenant);
  const call = await upstream("Auth", ctx).POST("/v1/auth/register", {
    body: toRegisterRequest(form, terms, ctx.lang, device),
  });
  const auth = unwrap(call);
  return {
    result: { player: toPlayerSummary(auth.player) },
    session: sessionFromTokens(ctx.tenant, auth.tokens, apiNow(call.response)),
  };
}

/**
 * Sets a new password with the reset code. The API revokes every session of
 * that account; this browser's cookie is not touched — it may be someone
 * else's account altogether.
 */
export async function resetPassword(
  ctx: SessionContext,
  form: PasswordResetForm,
): Promise<void> {
  const call = await upstream("Auth", ctx).POST("/v1/auth/password/reset", {
    body: toPasswordResetRequest(form),
  });
  if (!call.response.ok) {
    throw new UpstreamError(call.response.status, call.error ?? null);
  }
}
