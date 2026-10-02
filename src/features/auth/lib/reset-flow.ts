import type { OtpChallengeView } from "../types";
import { authErrorMessage, isCodeRefusal, type AuthErrorView } from "./errors";

/**
 * A forgotten password, as a pure reducer: phone → code → new password. As in
 * registration, the code is checked with the new password, so its refusal
 * sends the player back to the code. When it works the dialog switches to
 * log in (REG-09); nothing here signs anyone in.
 */
export type ResetStep = "phone" | "otp" | "password";

export interface ResetState {
  step: ResetStep;
  /** As typed: nine digits, or `+251…`. */
  phone: string;
  challengeId: string | null;
  /** When another code may be asked for, in epoch ms (`resend_after`). */
  resendAt: number | null;
  otp: string;
  /** Kept while the dialog is open, so a refused code costs no retyping. */
  newPassword: string;
  pending: boolean;
  error: AuthErrorView | null;
  attempts: number;
}

export type ResetEvent =
  | { type: "sendCode"; phone: string }
  | { type: "codeSent"; challenge: OtpChallengeView; now: number }
  | { type: "enterCode"; otp: string }
  | { type: "submitPassword"; newPassword: string }
  | { type: "failed"; error: unknown }
  | { type: "back" };

export const initialReset = (phone = ""): ResetState => ({
  step: "phone",
  phone,
  challengeId: null,
  resendAt: null,
  otp: "",
  newPassword: "",
  pending: false,
  error: null,
  attempts: 0,
});

const FIELDS: Record<ResetStep, readonly string[]> = {
  phone: ["phone"],
  otp: [],
  password: ["new_password"],
};

const PREVIOUS: Partial<Record<ResetStep, ResetStep>> = {
  otp: "phone",
  password: "otp",
};

export const canGoBackReset = (state: ResetState): boolean =>
  !state.pending && PREVIOUS[state.step] !== undefined;

export function resetReducer(state: ResetState, event: ResetEvent): ResetState {
  switch (event.type) {
    case "sendCode":
      return { ...state, phone: event.phone, pending: true, error: null };
    case "codeSent":
      return {
        ...state,
        step: "otp",
        challengeId: event.challenge.challengeId,
        resendAt: event.now + event.challenge.resendAfter * 1000,
        otp: "",
        pending: false,
        error: null,
        attempts: state.attempts + 1,
      };
    case "enterCode":
      return { ...state, step: "password", otp: event.otp, error: null };
    case "submitPassword":
      return {
        ...state,
        newPassword: event.newPassword,
        pending: true,
        error: null,
      };
    case "failed": {
      const toCode = state.step === "password" && isCodeRefusal(event.error);
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
      };
    }
  }
}
