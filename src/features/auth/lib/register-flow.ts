import type {
  FaydaChallengeView,
  KycResultView,
  OtpChallengeView,
} from "../types";
import {
  authErrorMessage,
  isCodeRefusal,
  isStaleTerms,
  type AuthErrorView,
} from "./errors";

/**
 * Registration and Fayda verification as a pure reducer, so the dialog's
 * decisions can be tested without rendering it (as `flow.ts` does for login).
 *
 * phone → code → details → ID → Fayda's code → result. The SMS code is only
 * held on its step: the API checks it with the details (C01 §6), so a refusal
 * of the code lands back on the code step. What the player typed — the
 * password included — lives here only while the dialog is open.
 */
export type RegisterStep =
  "phone" | "otp" | "details" | "kyc" | "kycOtp" | "result";

export interface RegisterState {
  /** `verify` is the ID step alone, for a player who is already signed in. */
  mode: "register" | "verify";
  step: RegisterStep;
  /** As typed: nine digits, or `+251…`. */
  phone: string;
  /**
   * Both consents were ticked when the code was asked for — kept so going
   * back to change the number does not ask for them again.
   */
  consented: boolean;
  /** The terms version on screen when the boxes were ticked; sent back at Create account. */
  termsVersion: string | null;
  /**
   * The terms changed after the consent: the phone step asks for it again,
   * and the code already sent still stands — no second SMS.
   */
  reconsent: boolean;
  challengeId: string | null;
  /** When another code may be asked for, in epoch ms (`resend_after`). */
  resendAt: number | null;
  /** The SMS code, held until Create account. */
  otp: string;
  fullName: string;
  /** As typed, `DD/MM/YYYY`. */
  dateOfBirth: string;
  password: string;
  /** The account exists: nothing before the ID step to go back to. */
  created: boolean;
  /** The Fayda number, kept for Try again and Send a new code. */
  fin: string;
  caseId: string | null;
  /** Fayda's masked phone, as the API gave it. */
  otpSentTo: string | null;
  result: KycResultView | null;
  pending: boolean;
  error: AuthErrorView | null;
  /** Refusals and new codes so far; a code step is remounted per attempt. */
  attempts: number;
}

export type RegisterEvent =
  | { type: "sendCode"; phone: string; termsVersion: string | null }
  | { type: "reconsented"; termsVersion: string | null }
  | { type: "codeSent"; challenge: OtpChallengeView; now: number }
  | { type: "enterCode"; otp: string }
  | {
      type: "submitDetails";
      fullName: string;
      dateOfBirth: string;
      password: string;
    }
  | { type: "created" }
  | { type: "startFayda"; fin: string }
  | { type: "faydaSent"; challenge: FaydaChallengeView }
  | { type: "submitFaydaCode" }
  | { type: "verified"; result: KycResultView }
  | { type: "failed"; error: unknown }
  | { type: "back" }
  | { type: "retryKyc" };

export function initialRegister(mode: RegisterState["mode"]): RegisterState {
  return {
    mode,
    step: mode === "verify" ? "kyc" : "phone",
    phone: "",
    consented: false,
    termsVersion: null,
    reconsent: false,
    challengeId: null,
    resendAt: null,
    otp: "",
    fullName: "",
    dateOfBirth: "",
    password: "",
    created: mode === "verify",
    fin: "",
    caseId: null,
    otpSentTo: null,
    result: null,
    pending: false,
    error: null,
    attempts: 0,
  };
}

/** The contract's field names each step shows, for `VALIDATION_FAILED`. */
const FIELDS: Record<RegisterStep, readonly string[]> = {
  phone: ["phone"],
  otp: [],
  details: ["full_name", "date_of_birth", "password"],
  kyc: ["fayda_number"],
  kycOtp: [],
  result: [],
};

const PREVIOUS: Partial<Record<RegisterStep, RegisterStep>> = {
  otp: "phone",
  details: "otp",
  kycOtp: "kyc",
};

/** Whether the back arrow has somewhere to go. */
export const canGoBack = (state: RegisterState): boolean =>
  !state.pending && PREVIOUS[state.step] !== undefined;

const STEPPER: Partial<Record<RegisterStep, number>> = {
  phone: 0,
  otp: 1,
  details: 2,
  kyc: 3,
  kycOtp: 3,
};

/** Where the progress bar stands; `null` for the ID step alone and the result. */
export const stepperIndex = (state: RegisterState): number | null =>
  state.mode === "register" ? (STEPPER[state.step] ?? null) : null;

export function registerReducer(
  state: RegisterState,
  event: RegisterEvent,
): RegisterState {
  switch (event.type) {
    case "sendCode":
      return {
        ...state,
        phone: event.phone,
        consented: true,
        termsVersion: event.termsVersion,
        reconsent: false,
        pending: true,
        error: null,
      };
    case "reconsented":
      // Same phone, same code: straight back to the details, as typed.
      return {
        ...state,
        step: "details",
        consented: true,
        termsVersion: event.termsVersion,
        reconsent: false,
        error: null,
      };
    case "codeSent":
      return {
        ...state,
        step: "otp",
        challengeId: event.challenge.challengeId,
        resendAt: event.now + event.challenge.resendAfter * 1000,
        // A new code makes the old one worthless.
        otp: "",
        pending: false,
        error: null,
        attempts: state.attempts + 1,
      };
    case "enterCode":
      return { ...state, step: "details", otp: event.otp, error: null };
    case "submitDetails":
      return {
        ...state,
        fullName: event.fullName,
        dateOfBirth: event.dateOfBirth,
        password: event.password,
        pending: true,
        error: null,
      };
    case "created":
      return {
        ...state,
        step: "kyc",
        created: true,
        // The account exists; neither is needed again.
        password: "",
        otp: "",
        pending: false,
        error: null,
      };
    case "startFayda":
      return { ...state, fin: event.fin, pending: true, error: null };
    case "faydaSent":
      return {
        ...state,
        step: "kycOtp",
        caseId: event.challenge.caseId,
        otpSentTo: event.challenge.otpSentTo,
        pending: false,
        error: null,
        attempts: state.attempts + 1,
      };
    case "submitFaydaCode":
      return { ...state, pending: true, error: null };
    case "verified":
      return {
        ...state,
        step: "result",
        result: event.result,
        pending: false,
        error: null,
      };
    case "failed": {
      if (state.step === "details" && isStaleTerms(event.error)) {
        // New terms since the boxes were ticked: ask again, unticked.
        return {
          ...state,
          step: "phone",
          consented: false,
          reconsent: true,
          pending: false,
          error: { key: "auth.errors.termsUpdated" },
          attempts: state.attempts + 1,
        };
      }
      // The registration code is checked with the details: its refusal
      // belongs to the code step, emptied for another go.
      const toCode = state.step === "details" && isCodeRefusal(event.error);
      const step = toCode ? "otp" : state.step;
      return {
        ...state,
        step,
        otp: toCode ? "" : state.otp,
        pending: false,
        error: authErrorMessage(event.error, {
          expired: "sendNewCode",
          fields: FIELDS[step],
        }),
        attempts: state.attempts + 1,
      };
    }
    case "back": {
      const previous = PREVIOUS[state.step];
      if (!previous || state.pending) return state;
      return {
        ...state,
        step: previous,
        error: null,
        ...(state.step === "otp" ? { challengeId: null, resendAt: null } : {}),
        ...(state.step === "kycOtp" ? { caseId: null, otpSentTo: null } : {}),
      };
    }
    case "retryKyc":
      return {
        ...state,
        step: "kyc",
        result: null,
        caseId: null,
        otpSentTo: null,
        error: null,
      };
  }
}
