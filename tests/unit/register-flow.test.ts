import { describe, expect, it } from "vitest";
import { isIsoDate, parseBirthDate } from "@/features/auth/lib/birth-date";
import { authErrorMessage } from "@/features/auth/lib/errors";
import { initLogin } from "@/features/auth/lib/flow";
import {
  canGoBack,
  initialRegister,
  registerReducer,
  stepperIndex,
  type RegisterEvent,
  type RegisterState,
} from "@/features/auth/lib/register-flow";
import {
  initialReset,
  resetReducer,
  type ResetEvent,
  type ResetState,
} from "@/features/auth/lib/reset-flow";
import { ApiError } from "@/lib/api/errors";

const problem = (
  status: number,
  code: string,
  errors: { field?: string; code: string; message?: string }[] = [],
) =>
  new ApiError(
    "The API's title",
    status,
    code,
    { type: "about:blank", title: "The API's title", status, code, errors },
    errors,
  );

const NOW = Date.parse("2026-10-03T09:00:00Z");
const CHALLENGE = {
  challengeId: "01J9A7QK3M8X2B7Y4Z5N6P0R1S",
  expiresIn: 300,
  resendAfter: 60,
};
const DETAILS = {
  fullName: "Abebe Kebede",
  dateOfBirth: "12/04/1998",
  password: "correct horse battery",
};

const run = (state: RegisterState, ...events: RegisterEvent[]) =>
  events.reduce(registerReducer, state);
const runReset = (state: ResetState, ...events: ResetEvent[]) =>
  events.reduce(resetReducer, state);

/** A registration that has reached the details step. */
const atDetails = () =>
  run(
    initialRegister("register"),
    { type: "sendCode", phone: "911234567", termsVersion: "2026-10" },
    { type: "codeSent", challenge: CHALLENGE, now: NOW },
    { type: "enterCode", otp: "482913" },
  );

describe("the registration flow", () => {
  it("walks phone → code → details → ID → Fayda code → result (AC-1)", () => {
    let state = run(initialRegister("register"), {
      type: "sendCode",
      phone: "911234567",
      termsVersion: "2026-10",
    });
    expect(state).toMatchObject({ step: "phone", pending: true });

    state = run(state, { type: "codeSent", challenge: CHALLENGE, now: NOW });
    expect(state).toMatchObject({
      step: "otp",
      phone: "911234567",
      challengeId: CHALLENGE.challengeId,
      resendAt: NOW + 60_000,
      pending: false,
    });

    // The code is only held: the API checks it with the details.
    state = run(state, { type: "enterCode", otp: "482913" });
    expect(state).toMatchObject({ step: "details", otp: "482913" });

    state = run(state, { type: "submitDetails", ...DETAILS });
    expect(state).toMatchObject({ step: "details", pending: true, ...DETAILS });

    state = run(state, { type: "created" });
    expect(state).toMatchObject({
      step: "kyc",
      created: true,
      pending: false,
      // Not needed once the account exists.
      password: "",
      otp: "",
    });

    state = run(
      state,
      { type: "startFayda", fin: "482109375516" },
      {
        type: "faydaSent",
        challenge: {
          caseId: "01J9A7T0000000000000000001",
          otpSentTo: "+2519••••567",
          expiresIn: 300,
        },
      },
    );
    expect(state).toMatchObject({
      step: "kycOtp",
      fin: "482109375516",
      caseId: "01J9A7T0000000000000000001",
      otpSentTo: "+2519••••567",
    });

    state = run(
      state,
      { type: "submitFaydaCode" },
      { type: "verified", result: { status: "verified", reasonCode: null } },
    );
    expect(state).toMatchObject({
      step: "result",
      result: { status: "verified", reasonCode: null },
      pending: false,
    });
  });

  it("sends a wrong code back to the code step, boxes cleared, details kept (AC-2)", () => {
    const state = run(
      atDetails(),
      { type: "submitDetails", ...DETAILS },
      { type: "failed", error: problem(422, "AUTH_OTP_INVALID") },
    );
    expect(state).toMatchObject({
      step: "otp",
      otp: "",
      pending: false,
      error: { key: "auth.errors.AUTH_OTP_INVALID" },
      ...DETAILS,
    });
  });

  it("offers a new code when it has expired, and a new code starts over cleanly", () => {
    let state = run(
      atDetails(),
      { type: "submitDetails", ...DETAILS },
      { type: "failed", error: problem(422, "AUTH_OTP_EXPIRED") },
    );
    expect(state).toMatchObject({
      step: "otp",
      error: { key: "auth.errors.otpExpiredResend", fix: "sendNewCode" },
    });

    const attempts = state.attempts;
    state = run(
      state,
      { type: "sendCode", phone: state.phone, termsVersion: "2026-10" },
      {
        type: "codeSent",
        challenge: { ...CHALLENGE, challengeId: "second" },
        now: NOW + 400_000,
      },
    );
    expect(state).toMatchObject({
      step: "otp",
      challengeId: "second",
      resendAt: NOW + 460_000,
      error: null,
      ...DETAILS,
    });
    // A new code remounts the boxes, empty.
    expect(state.attempts).toBeGreaterThan(attempts);
  });

  it("keeps other refusals on the step that caused them", () => {
    const taken = run(
      initialRegister("register"),
      { type: "sendCode", phone: "911234567", termsVersion: "2026-10" },
      { type: "failed", error: problem(409, "REG_PHONE_TAKEN") },
    );
    expect(taken).toMatchObject({
      step: "phone",
      phone: "911234567",
      error: { key: "auth.errors.REG_PHONE_TAKEN", fix: "logInInstead" },
    });

    const underage = run(
      atDetails(),
      { type: "submitDetails", ...DETAILS },
      { type: "failed", error: problem(422, "REG_UNDERAGE") },
    );
    expect(underage).toMatchObject({
      step: "details",
      error: { key: "auth.errors.REG_UNDERAGE", fix: "responsibleGaming" },
    });
  });

  it("asks for the consents again when the terms changed, keeping the code and the details", () => {
    let state = run(
      atDetails(),
      { type: "submitDetails", ...DETAILS },
      {
        type: "failed",
        error: problem(422, "VALIDATION_FAILED", [
          { field: "accept_terms_version", code: "STALE" },
        ]),
      },
    );
    expect(state).toMatchObject({
      step: "phone",
      consented: false,
      reconsent: true,
      otp: "482913",
      challengeId: CHALLENGE.challengeId,
      error: { key: "auth.errors.termsUpdated" },
      ...DETAILS,
    });

    state = run(state, { type: "reconsented", termsVersion: "2026-11" });
    expect(state).toMatchObject({
      step: "details",
      consented: true,
      reconsent: false,
      termsVersion: "2026-11",
      otp: "482913",
      error: null,
    });
  });

  it("puts VALIDATION_FAILED on the fields this step has, and the rest in the notice", () => {
    const state = run(
      atDetails(),
      { type: "submitDetails", ...DETAILS },
      {
        type: "failed",
        error: problem(422, "VALIDATION_FAILED", [
          { field: "password", code: "BREACHED", message: "Too common." },
          { field: "full_name", code: "FORMAT" },
          { field: "language", code: "ENUM", message: "Unknown language." },
        ]),
      },
    );
    expect(state.step).toBe("details");
    expect(state.error).toEqual({
      key: "auth.errors.VALIDATION_FAILED",
      fields: { password: "Too common.", full_name: null },
      detail: "Unknown language.",
    });
  });

  it("goes back only where there is something to go back to", () => {
    const otp = run(
      initialRegister("register"),
      { type: "sendCode", phone: "911234567", termsVersion: "2026-10" },
      { type: "codeSent", challenge: CHALLENGE, now: NOW },
    );
    expect(canGoBack(otp)).toBe(true);
    expect(run(otp, { type: "back" })).toMatchObject({
      step: "phone",
      phone: "911234567",
      challengeId: null,
    });
    expect(run(atDetails(), { type: "back" }).step).toBe("otp");

    // The account exists from the ID step on: nothing before it to go back to.
    const kyc = run(
      atDetails(),
      { type: "submitDetails", ...DETAILS },
      { type: "created" },
    );
    expect(canGoBack(kyc)).toBe(false);
    expect(run(kyc, { type: "back" })).toBe(kyc);
    expect(canGoBack(initialRegister("register"))).toBe(false);

    const kycOtp = run(
      kyc,
      { type: "startFayda", fin: "482109375516" },
      {
        type: "faydaSent",
        challenge: { caseId: "c1", otpSentTo: "+2519••••567", expiresIn: 300 },
      },
    );
    expect(canGoBack(kycOtp)).toBe(true);
    expect(run(kycOtp, { type: "back" })).toMatchObject({
      step: "kyc",
      caseId: null,
      fin: "482109375516",
    });
  });

  it("tries the ID again after needs_info", () => {
    const state = run(
      initialRegister("verify"),
      { type: "startFayda", fin: "482109375516" },
      {
        type: "faydaSent",
        challenge: { caseId: "c1", otpSentTo: "+2519••••567", expiresIn: 300 },
      },
      { type: "submitFaydaCode" },
      {
        type: "verified",
        result: { status: "needs_info", reasonCode: "NAME_MISMATCH" },
      },
      { type: "retryKyc" },
    );
    expect(state).toMatchObject({
      step: "kyc",
      result: null,
      caseId: null,
      fin: "482109375516",
    });
  });

  it("offers Do this later when Fayda is down, and Log in when the session is gone", () => {
    const kyc = initialRegister("verify");
    expect(
      run(
        kyc,
        { type: "startFayda", fin: "482109375516" },
        { type: "failed", error: problem(503, "KYC_PROVIDER_UNAVAILABLE") },
      ).error,
    ).toEqual({
      key: "auth.errors.KYC_PROVIDER_UNAVAILABLE",
      fix: "doThisLater",
    });
    expect(
      run(
        kyc,
        { type: "startFayda", fin: "482109375516" },
        { type: "failed", error: problem(401, "AUTH_TOKEN_EXPIRED") },
      ).error,
    ).toEqual({ key: "auth.errors.AUTH_TOKEN_EXPIRED", fix: "logInAgain" });
  });

  it("numbers the stepper for registration only", () => {
    expect(stepperIndex(initialRegister("register"))).toBe(0);
    expect(stepperIndex(atDetails())).toBe(2);
    expect(stepperIndex(initialRegister("verify"))).toBeNull();
    const verify = initialRegister("verify");
    expect(verify).toMatchObject({ step: "kyc", created: true });
  });
});

describe("the reset flow", () => {
  it("phone → code → new password, with a wrong code sent back to the code (AC-9)", () => {
    let state = runReset(
      initialReset(),
      { type: "sendCode", phone: "911234567" },
      { type: "codeSent", challenge: CHALLENGE, now: NOW },
    );
    expect(state).toMatchObject({
      step: "otp",
      resendAt: NOW + 60_000,
      pending: false,
    });

    state = runReset(
      state,
      { type: "enterCode", otp: "551203" },
      { type: "submitPassword", newPassword: "another long passphrase" },
    );
    expect(state).toMatchObject({
      step: "password",
      otp: "551203",
      pending: true,
    });

    state = runReset(state, {
      type: "failed",
      error: problem(422, "AUTH_OTP_INVALID"),
    });
    expect(state).toMatchObject({
      step: "otp",
      otp: "",
      newPassword: "another long passphrase",
      error: { key: "auth.errors.AUTH_OTP_INVALID" },
    });

    expect(runReset(state, { type: "back" }).step).toBe("phone");
  });

  it("starts log in with the phone kept and the notice", () => {
    expect(
      initLogin({ phone: "911234567", notice: "passwordChanged" }),
    ).toMatchObject({
      step: "login",
      phone: "911234567",
      notice: "passwordChanged",
    });
    expect(initLogin(null)).toMatchObject({ phone: "", notice: null });
  });
});

describe("what a registration refusal says", () => {
  it("says how long to wait when the API's Retry-After does", () => {
    const limited = (retryAfter: number | null) =>
      authErrorMessage(
        new ApiError(
          "Too many",
          429,
          "AUTH_OTP_RATE_LIMITED",
          undefined,
          [],
          retryAfter,
        ),
      );
    expect(limited(null)).toEqual({ key: "auth.errors.RATE_LIMITED" });
    expect(limited(45)).toEqual({
      key: "auth.errors.rateLimitedSeconds",
      values: { seconds: 45 },
    });
    expect(limited(900)).toEqual({
      key: "auth.errors.rateLimitedMinutes",
      values: { minutes: 15 },
    });
    expect(limited(121)).toEqual({
      key: "auth.errors.rateLimitedMinutes",
      values: { minutes: 3 },
    });
  });

  it("has its own words for every F4b code, by code and never by title", () => {
    expect(authErrorMessage(problem(409, "REG_PHONE_TAKEN"))).toEqual({
      key: "auth.errors.REG_PHONE_TAKEN",
      fix: "logInInstead",
    });
    expect(authErrorMessage(problem(409, "REG_ID_TAKEN"))).toEqual({
      key: "auth.errors.REG_ID_TAKEN",
    });
    expect(authErrorMessage(problem(422, "REG_UNDERAGE"))).toEqual({
      key: "auth.errors.REG_UNDERAGE",
      fix: "responsibleGaming",
    });
    expect(authErrorMessage(problem(503, "AUTH_OTP_UNAVAILABLE"))).toEqual({
      key: "auth.errors.AUTH_OTP_UNAVAILABLE",
    });
    expect(authErrorMessage(problem(503, "KYC_PROVIDER_UNAVAILABLE"))).toEqual({
      key: "auth.errors.KYC_PROVIDER_UNAVAILABLE",
      fix: "doThisLater",
    });
    expect(
      authErrorMessage(problem(422, "AUTH_OTP_EXPIRED"), {
        expired: "sendNewCode",
      }),
    ).toEqual({ key: "auth.errors.otpExpiredResend", fix: "sendNewCode" });
  });
});

describe("dates of birth", () => {
  const today = new Date(2026, 9, 3);

  it("reads day, month, year as Ethiopians write them and sends YYYY-MM-DD", () => {
    for (const typed of [
      "14/03/1996",
      "14 / 03 / 1996",
      "14.03.1996",
      "14-03-1996",
      "14031996",
      "4/3/1996",
    ]) {
      expect(parseBirthDate(typed, today), typed).toBe(
        typed === "4/3/1996" ? "1996-03-04" : "1996-03-14",
      );
    }
  });

  it("refuses what is not a real date in the past, and leaves the age to the API", () => {
    for (const typed of [
      "",
      "31/02/1996",
      "14/13/1996",
      "1996-03-14",
      "04/10/2026",
      "01/01/1899",
      "abc",
    ]) {
      expect(parseBirthDate(typed, today), typed).toBeNull();
    }
    // Yesterday is a real date of birth; whether it is old enough is not ours to say.
    expect(parseBirthDate("02/10/2026", today)).toBe("2026-10-02");
    expect(isIsoDate("2026-10-03", today)).toBe(true);
    expect(isIsoDate("2026-10-04", today)).toBe(false);
  });
});
