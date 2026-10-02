import { authErrorMessage, type AuthErrorView } from "./errors";

/**
 * The login flow's state, as a pure reducer so the dialog's decisions can be
 * tested without rendering it. The password lives here only while the flow
 * runs — a new device's second call needs it with the code (C01 §6) — and
 * goes with the dialog.
 */
export interface LoginState {
  step: "login" | "loginOtp";
  /** As typed: nine digits, or `+251…`. */
  phone: string;
  password: string;
  challengeId: string | null;
  expiresIn: number | null;
  pending: boolean;
  error: AuthErrorView | null;
  /** Refusals so far; the code step is remounted per attempt. */
  attempts: number;
}

export const initialLogin: LoginState = {
  step: "login",
  phone: "",
  password: "",
  challengeId: null,
  expiresIn: null,
  pending: false,
  error: null,
  attempts: 0,
};

export type LoginEvent =
  | { type: "submit"; phone: string; password: string }
  | { type: "otpRequired"; challengeId: string; expiresIn: number | null }
  | { type: "submitOtp"; otp: string }
  | { type: "failed"; error: unknown }
  | { type: "back" }
  | { type: "fix" }
  | { type: "done" };

const backToForm = (state: LoginState): LoginState => ({
  ...state,
  step: "login",
  challengeId: null,
  expiresIn: null,
  pending: false,
  error: null,
});

export function loginReducer(state: LoginState, event: LoginEvent): LoginState {
  switch (event.type) {
    case "submit":
      return {
        ...state,
        phone: event.phone,
        password: event.password,
        pending: true,
        error: null,
      };
    case "otpRequired":
      return {
        ...state,
        step: "loginOtp",
        challengeId: event.challengeId,
        expiresIn: event.expiresIn,
        pending: false,
        error: null,
      };
    case "submitOtp":
      return { ...state, pending: true, error: null };
    case "failed":
      return {
        ...state,
        pending: false,
        error: authErrorMessage(event.error),
        attempts: state.attempts + 1,
      };
    case "back":
      return backToForm(state);
    case "fix":
      // An expired code means a fresh login, which brings a fresh challenge.
      return state.error?.fix === "logInAgain"
        ? backToForm(state)
        : { ...state, error: null };
    case "done":
      return initialLogin;
  }
}
