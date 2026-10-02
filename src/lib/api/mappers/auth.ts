import type {
  Device,
  LoginForm,
  LoginResult,
  Player,
  PlayerSummary,
} from "@/features/auth/types";
import { toE164 } from "@/features/auth/lib/phone";
import type { components } from "@/lib/api/schema";

type Me = components["schemas"]["Me"];
type ContractPlayerSummary = components["schemas"]["PlayerSummary"];
type OtpRequired = components["schemas"]["OtpRequired"];
type LoginRequest = components["schemas"]["LoginRequest"];

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

/** The contract's `LoginRequest` from what the player typed and this browser. */
export function toLoginRequest(form: LoginForm, device: Device): LoginRequest {
  return {
    phone: toE164(form.phone) ?? form.phone,
    password: form.password,
    device: {
      fingerprint: device.fingerprint,
      platform: device.platform,
      app_version: device.appVersion,
    },
    ...(form.challengeId ? { challenge_id: form.challengeId } : {}),
    ...(form.otp ? { otp: form.otp } : {}),
  };
}
