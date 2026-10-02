import { describe, expect, it } from "vitest";
import { authErrorMessage } from "@/features/auth/lib/errors";
import { initialLogin, loginReducer } from "@/features/auth/lib/flow";
import { ApiError, ContractError } from "@/lib/api/errors";

const problem = (status: number, code: string, detail?: string) =>
  new ApiError("The API's title", status, code, {
    type: "about:blank",
    title: "The API's title",
    status,
    code,
    detail,
  });

describe("the login flow", () => {
  it("asks for the code when the API answers otp_required, keeping the phone and password for the second call (AC-6)", () => {
    let state = loginReducer(initialLogin, {
      type: "submit",
      phone: "911234567",
      password: "correct horse battery",
    });
    expect(state.pending).toBe(true);
    expect(state.error).toBeNull();

    state = loginReducer(state, {
      type: "otpRequired",
      challengeId: "01J9A7QK3M8X2B7Y4Z5N6P0R1T",
      expiresIn: 300,
    });
    expect(state).toMatchObject({
      step: "loginOtp",
      phone: "911234567",
      password: "correct horse battery",
      challengeId: "01J9A7QK3M8X2B7Y4Z5N6P0R1T",
      expiresIn: 300,
      pending: false,
      error: null,
    });
  });

  it("goes back from the code to the form with the fields kept and the challenge dropped", () => {
    const atOtp = loginReducer(
      loginReducer(initialLogin, {
        type: "submit",
        phone: "911234567",
        password: "pw",
      }),
      { type: "otpRequired", challengeId: "c1", expiresIn: null },
    );
    const back = loginReducer(atOtp, { type: "back" });
    expect(back).toMatchObject({
      step: "login",
      phone: "911234567",
      password: "pw",
      challengeId: null,
      error: null,
    });
  });

  it("puts a wrong code's error on the code step, and a wrong password's on the form", () => {
    const atOtp = loginReducer(
      loginReducer(initialLogin, {
        type: "submit",
        phone: "911234567",
        password: "pw",
      }),
      { type: "otpRequired", challengeId: "c1", expiresIn: null },
    );
    const wrongCode = loginReducer(
      loginReducer(atOtp, { type: "submitOtp", otp: "000000" }),
      { type: "failed", error: problem(422, "AUTH_OTP_INVALID") },
    );
    expect(wrongCode.step).toBe("loginOtp");
    expect(wrongCode.pending).toBe(false);
    expect(wrongCode.error).toMatchObject({
      key: "auth.errors.AUTH_OTP_INVALID",
    });
    // The challenge is still good: the player types the code again.
    expect(wrongCode.challengeId).toBe("c1");

    const wrongPassword = loginReducer(
      loginReducer(initialLogin, {
        type: "submit",
        phone: "911234567",
        password: "x",
      }),
      { type: "failed", error: problem(401, "AUTH_INVALID_CREDENTIALS") },
    );
    expect(wrongPassword.step).toBe("login");
    expect(wrongPassword.error).toMatchObject({
      key: "auth.errors.AUTH_INVALID_CREDENTIALS",
    });
  });

  it("offers to log in again when the code has expired, which starts a new challenge", () => {
    const atOtp = loginReducer(
      loginReducer(initialLogin, {
        type: "submit",
        phone: "911234567",
        password: "pw",
      }),
      { type: "otpRequired", challengeId: "c1", expiresIn: 300 },
    );
    const expired = loginReducer(
      loginReducer(atOtp, { type: "submitOtp", otp: "482913" }),
      { type: "failed", error: problem(422, "AUTH_OTP_EXPIRED") },
    );
    expect(expired.error).toMatchObject({
      key: "auth.errors.AUTH_OTP_EXPIRED",
      fix: "logInAgain",
    });

    const again = loginReducer(expired, { type: "fix" });
    expect(again).toMatchObject({
      step: "login",
      phone: "911234567",
      challengeId: null,
      error: null,
    });
  });

  it("clears the last error on the next submit", () => {
    const failed = loginReducer(
      loginReducer(initialLogin, {
        type: "submit",
        phone: "911234567",
        password: "x",
      }),
      { type: "failed", error: problem(401, "AUTH_INVALID_CREDENTIALS") },
    );
    const retry = loginReducer(failed, {
      type: "submit",
      phone: "911234567",
      password: "y",
    });
    expect(retry.error).toBeNull();
    expect(retry.pending).toBe(true);
  });
});

describe("what a refusal says", () => {
  it("has its own words for every code the task names, by code and never by title", () => {
    expect(authErrorMessage(problem(401, "AUTH_INVALID_CREDENTIALS"))).toEqual({
      key: "auth.errors.AUTH_INVALID_CREDENTIALS",
    });
    expect(authErrorMessage(problem(422, "AUTH_OTP_INVALID"))).toEqual({
      key: "auth.errors.AUTH_OTP_INVALID",
    });
    expect(authErrorMessage(problem(422, "AUTH_OTP_EXPIRED"))).toEqual({
      key: "auth.errors.AUTH_OTP_EXPIRED",
      fix: "logInAgain",
    });
    expect(authErrorMessage(problem(429, "RATE_LIMITED"))).toEqual({
      key: "auth.errors.RATE_LIMITED",
    });
    expect(authErrorMessage(problem(429, "AUTH_OTP_RATE_LIMITED"))).toEqual({
      key: "auth.errors.RATE_LIMITED",
    });
  });

  it("passes the lock-out's detail on, since it says how long", () => {
    expect(
      authErrorMessage(problem(423, "AUTH_LOCKED", "Try again in 15 minutes.")),
    ).toEqual({
      key: "auth.errors.AUTH_LOCKED",
      detail: "Try again in 15 minutes.",
    });
  });

  it("shows the API's own title for a code it does not know, and a plain failure for the rest", () => {
    expect(authErrorMessage(problem(403, "RG_SELF_EXCLUDED"))).toEqual({
      text: "The API's title",
    });
    expect(
      authErrorMessage(new ApiError("Failed to fetch", 0, "network")),
    ).toEqual({
      key: "auth.errors.failed",
    });
    expect(authErrorMessage(problem(503, "SERVICE_UNAVAILABLE"))).toEqual({
      key: "auth.errors.failed",
    });
    expect(authErrorMessage(new ContractError("/me", "bad shape"))).toEqual({
      key: "auth.errors.failed",
    });
    expect(authErrorMessage(new Error("boom"))).toEqual({
      key: "auth.errors.failed",
    });
  });
});
