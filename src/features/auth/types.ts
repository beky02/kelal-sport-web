/**
 * Registration runs phone → code → password → ID; `login` and `forgot` sit
 * outside that sequence and show no progress bar.
 */
export type AuthStep =
  "phone" | "otp" | "password" | "kyc" | "kycDone" | "login" | "forgot";

/** The registration steps, in order. Index drives the stepper. */
export const REGISTRATION_STEPS: readonly AuthStep[] = [
  "phone",
  "otp",
  "password",
  "kyc",
  "kycDone",
];

/** How many steps the progress bar counts — `kycDone` is a result, not a step. */
export const STEP_COUNT = 4;

export const stepIndex = (step: AuthStep): number =>
  REGISTRATION_STEPS.indexOf(step);

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
