import type {
  Device,
  LoginForm,
  LoginResult,
  OtpChallengeView,
  OtpRequestForm,
  PasswordResetForm,
  Player,
  PlayerSummary,
  RegisterForm,
} from "@/features/auth/types";
import { toE164 } from "@/features/auth/lib/phone";
import type { components } from "@/lib/api/schema";
import type { Lang } from "@/types/common";

type Me = components["schemas"]["Me"];
type ContractPlayerSummary = components["schemas"]["PlayerSummary"];
type OtpRequired = components["schemas"]["OtpRequired"];
type LoginRequest = components["schemas"]["LoginRequest"];
type OtpRequest = components["schemas"]["OtpRequest"];
type OtpChallenge = components["schemas"]["OtpChallenge"];
type RegisterRequest = components["schemas"]["RegisterRequest"];
type PasswordResetRequest = components["schemas"]["PasswordResetRequest"];

/**
 * Who is signed in (C01). Pure: contract shape in, domain type out. What the
 * API left out stays `null` — never guessed.
 */
export function toPlayer(me: Me): Player {
  return {
    id: me.id,
    phone: me.phone,
    fullName: me.full_name,
    dateOfBirth: me.date_of_birth ?? null,
    language: me.language,
    status: me.status,
    kycStatus: me.kyc_status,
    marketingConsent: me.marketing_consent ?? null,
    createdAt: me.created_at ?? null,
    canWithdraw: me.can_withdraw ?? null,
    flags: {
      realityCheckMinutes: me.flags?.reality_check_minutes ?? null,
      excludedUntil: me.flags?.excluded_until ?? null,
    },
  };
}

export function toPlayerSummary(player: ContractPlayerSummary): PlayerSummary {
  return {
    id: player.id,
    phone: player.phone,
    fullName: player.full_name ?? null,
    kycStatus: player.kyc_status,
    language: player.language ?? null,
  };
}

/** Login's 202: a new device must answer an SMS code first. */
export function toOtpRequired(required: OtpRequired): LoginResult {
  return {
    status: "otp_required",
    challengeId: required.challenge_id,
    expiresIn: required.expires_in ?? null,
  };
}

const toDevice = (device: Device): LoginRequest["device"] => ({
  fingerprint: device.fingerprint,
  platform: device.platform,
  app_version: device.appVersion,
});

/** The contract's `LoginRequest` from what the player typed and this browser. */
export function toLoginRequest(form: LoginForm, device: Device): LoginRequest {
  return {
    phone: toE164(form.phone) ?? form.phone,
    password: form.password,
    device: toDevice(device),
    ...(form.challengeId ? { challenge_id: form.challengeId } : {}),
    ...(form.otp ? { otp: form.otp } : {}),
  };
}

// ── registration and reset (F4b) ────────────────────────────────────────────

export function toOtpRequest(form: OtpRequestForm): OtpRequest {
  return { phone: toE164(form.phone) ?? form.phone, purpose: form.purpose };
}

export function toOtpChallenge(challenge: OtpChallenge): OtpChallengeView {
  return {
    challengeId: challenge.challenge_id,
    expiresIn: challenge.expires_in,
    resendAfter: challenge.resend_after,
  };
}

/**
 * The contract's `RegisterRequest`: what the player typed, the code they were
 * sent, the tenant's terms version (never the browser's), the UI language and
 * this browser, and a promo code when the player typed one (REG-12, F7ca).
 * No national ID or deposit limit: the ID goes to Fayda after the account
 * exists, and a limit is not asked at sign-up (F4b scope). Marketing consent
 * is not asked either, so it is the contract's default, `false` — never
 * assumed given.
 */
export function toRegisterRequest(
  form: RegisterForm,
  termsVersion: string,
  language: Lang,
  device: Device,
): RegisterRequest {
  return {
    challenge_id: form.challengeId,
    otp: form.otp,
    full_name: form.fullName.trim(),
    date_of_birth: form.dateOfBirth,
    password: form.password,
    language,
    accept_terms_version: termsVersion,
    marketing_consent: false,
    ...(form.promoCode ? { promo_code: form.promoCode } : {}),
    device: toDevice(device),
  };
}

export function toPasswordResetRequest(
  form: PasswordResetForm,
): PasswordResetRequest {
  return {
    challenge_id: form.challengeId,
    otp: form.otp,
    new_password: form.newPassword,
  };
}
