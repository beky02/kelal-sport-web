/**
 * Which flow the auth dialog is showing. Each flow keeps its own position and
 * data (`lib/flow.ts`, `register-flow.ts`, `reset-flow.ts`); the entry is only
 * where it starts. `verify` is the ID step alone, for a signed-in player.
 */
export type AuthEntry = "login" | "register" | "verify" | "forgot";

/**
 * What a flow hands the next one when it switches: the phone already typed,
 * and a notice to show (a changed password, on the way back to log in).
 */
export interface AuthPrefill {
  phone: string;
  notice: "passwordChanged" | null;
}

// ── who is signed in ────────────────────────────────────────────────────────

import type { Lang } from "@/types/common";

export type KycStatus =
  "unverified" | "pending" | "verified" | "rejected" | "needs_info" | "expired";

export type PlayerStatus = "active" | "suspended" | "self_excluded" | "closed";

/**
 * The signed-in player, as `/v1/me` describes them. Read through `/api/me`
 * only: whether someone is signed in, and what they may do, is the API's to
 * say — never a flag the browser keeps (safety state is server state).
 */
export interface Player {
  id: string;
  phone: string;
  fullName: string;
  /** `YYYY-MM-DD`, or null when the API left it out. */
  dateOfBirth: string | null;
  language: Lang;
  status: PlayerStatus;
  kycStatus: KycStatus;
  marketingConsent: boolean | null;
  createdAt: string | null;
  /** The API's own verdict; null when it said nothing. */
  canWithdraw: boolean | null;
  flags: {
    realityCheckMinutes: number | null;
    excludedUntil: string | null;
  };
}

/** What `/api/me` answers: a player, or nobody. */
export interface SessionView {
  player: Player | null;
}

/** What the API hands back on login and registration — enough to greet. */
export interface PlayerSummary {
  id: string;
  phone: string;
  fullName: string | null;
  kycStatus: KycStatus;
  language: Lang | null;
}

/** What the player types; the code and challenge only on a new device's second call. */
export interface LoginForm {
  /** Nine digits as typed, or already `+251…`. */
  phone: string;
  password: string;
  challengeId?: string;
  otp?: string;
}

/**
 * Login's answer. The API's 202 (new device, C01 §6) becomes `otp_required`;
 * tokens never appear here — they live in the session cookie.
 */
export type LoginResult =
  | { status: "ok"; player: PlayerSummary }
  | { status: "otp_required"; challengeId: string; expiresIn: number | null };

/** This browser, as the contract's `Device`; the fingerprint is the server's device cookie. */
export interface Device {
  fingerprint: string;
  platform: "web";
  appVersion: string;
}

// ── registration, reset, KYC (F4b) ──────────────────────────────────────────

/** Why an SMS code is sent; the login code comes from login's own 202. */
export type OtpPurpose = "register" | "reset";

export interface OtpRequestForm {
  /** Nine digits as typed, or already `+251…`. */
  phone: string;
  purpose: OtpPurpose;
}

/** A code on its way (C01 §6). Seconds, from the API's answer. */
export interface OtpChallengeView {
  challengeId: string;
  expiresIn: number;
  resendAfter: number;
}

/**
 * What the details step sends. The code rides along: the API checks it here,
 * not on the code step. `termsVersion` is the version the phone step showed
 * when the box was ticked; the route handler refuses it once the tenant's
 * current version differs, and sends the API its own.
 */
export interface RegisterForm {
  challengeId: string;
  otp: string;
  fullName: string;
  /** `YYYY-MM-DD`, Gregorian. */
  dateOfBirth: string;
  password: string;
  acceptTerms: true;
  termsVersion: string;
  /** A promo code typed at sign-up, trimmed; left out when none (REG-12). */
  promoCode?: string;
}

/** Registration's answer: who was created. The tokens are in the cookie. */
export interface RegisterResult {
  player: PlayerSummary;
}

export interface PasswordResetForm {
  challengeId: string;
  otp: string;
  newPassword: string;
}

export interface FaydaStartForm {
  faydaNumber: string;
}

/** Fayda texted a code to the phone registered with the ID (C02 §6). */
export interface FaydaChallengeView {
  caseId: string;
  /** Masked by the API, shown as it comes. */
  otpSentTo: string;
  expiresIn: number;
}

export interface FaydaVerifyForm {
  caseId: string;
  otp: string;
}

export type KycReason =
  "NAME_MISMATCH" | "DOB_MISMATCH" | "DOC_UNREADABLE" | "UNDERAGE" | "OTHER";

/** Fayda's verdict (C02 §8); `reasonCode` says why when it is not `verified`. */
export interface KycResultView {
  status: "verified" | "pending" | "needs_info" | "rejected";
  reasonCode: KycReason | null;
}
