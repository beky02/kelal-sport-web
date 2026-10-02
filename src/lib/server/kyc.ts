import "server-only";
import type {
  FaydaChallengeView,
  FaydaStartForm,
  FaydaVerifyForm,
  KycResultView,
} from "@/features/auth/types";
import {
  toFaydaChallenge,
  toFaydaStartRequest,
  toFaydaVerifyRequest,
  toKycResult,
} from "@/lib/api/mappers/kyc";
import { withSession, type Session, type SessionContext } from "./session";
import { upstream } from "./upstream";

/**
 * Starts Fayda verification (C02 §8): Fayda texts a code to the phone
 * registered with the ID. For the signed-in player only; a lapsed access token
 * is refreshed first, as for every player call.
 */
export async function startFayda(
  ctx: SessionContext,
  session: Session,
  form: FaydaStartForm,
): Promise<FaydaChallengeView> {
  const challenge = await withSession(ctx, session, (authorization) =>
    upstream("KYC", { ...ctx, authorization }).POST("/v1/kyc/fayda/otp", {
      body: toFaydaStartRequest(form),
    }),
  );
  return toFaydaChallenge(challenge);
}

/** Completes it with Fayda's code: verified, pending, needs_info or rejected. */
export async function verifyFayda(
  ctx: SessionContext,
  session: Session,
  form: FaydaVerifyForm,
): Promise<KycResultView> {
  const result = await withSession(ctx, session, (authorization) =>
    upstream("KYC", { ...ctx, authorization }).POST("/v1/kyc/fayda/verify", {
      body: toFaydaVerifyRequest(form),
    }),
  );
  return toKycResult(result);
}
