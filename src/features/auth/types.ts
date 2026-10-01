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
