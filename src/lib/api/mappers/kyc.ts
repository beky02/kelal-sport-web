import type {
  FaydaChallengeView,
  FaydaStartForm,
  FaydaVerifyForm,
  KycResultView,
} from "@/features/auth/types";
import type { components } from "@/lib/api/schema";

type FaydaChallenge = components["schemas"]["FaydaChallenge"];
type KycResult = components["schemas"]["KycResult"];

/** `POST /v1/kyc/fayda/otp`'s body (C02 §6). */
export const toFaydaStartRequest = (form: FaydaStartForm) => ({
  fayda_number: form.faydaNumber,
});

/** `POST /v1/kyc/fayda/verify`'s body. */
export const toFaydaVerifyRequest = (form: FaydaVerifyForm) => ({
  case_id: form.caseId,
  otp: form.otp,
});

export function toFaydaChallenge(
  challenge: FaydaChallenge,
): FaydaChallengeView {
  return {
    caseId: challenge.case_id,
    otpSentTo: challenge.otp_sent_to,
    expiresIn: challenge.expires_in,
  };
}

/** Fayda's verdict. No reason is `null`, never a guessed one. */
export function toKycResult(result: KycResult): KycResultView {
  return { status: result.status, reasonCode: result.reason_code ?? null };
}
