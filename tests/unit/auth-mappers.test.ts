import { describe, expect, it } from "vitest";
import type { components } from "@/lib/api/schema";
import {
  toLoginRequest,
  toOtpChallenge,
  toOtpRequest,
  toOtpRequired,
  toPasswordResetRequest,
  toPlayer,
  toPlayerSummary,
  toRegisterRequest,
} from "@/lib/api/mappers/auth";
import {
  toFaydaChallenge,
  toFaydaStartRequest,
  toFaydaVerifyRequest,
  toKycResult,
} from "@/lib/api/mappers/kyc";
import {
  faydaChallengeSchema,
  kycResultSchema,
  loginResultSchema,
  otpChallengeSchema,
  playerSchema,
  registerResultSchema,
} from "@/lib/api/schemas";
import { example, requestExample, responseExample } from "../contract";

type AuthResult = components["schemas"]["AuthResult"];
type OtpRequired = components["schemas"]["OtpRequired"];
type OtpChallenge = components["schemas"]["OtpChallenge"];
type FaydaChallenge = components["schemas"]["FaydaChallenge"];
type KycResult = components["schemas"]["KycResult"];
type RegisterRequest = components["schemas"]["RegisterRequest"];

const DEVICE = {
  fingerprint: "fp_8c1d2e",
  platform: "web" as const,
  appVersion: "1.0.0",
};

describe("auth mappers", () => {
  it("maps the contract's /v1/me example to a player", () => {
    const player = toPlayer(example("/v1/me"));
    expect(player).toEqual({
      id: "01J9A7R0000000000000000001",
      phone: "+251911234567",
      fullName: "Abebe Kebede",
      dateOfBirth: "1998-04-12",
      language: "am",
      status: "active",
      kycStatus: "verified",
      marketingConsent: false,
      createdAt: "2026-10-01T08:15:00Z",
      canWithdraw: true,
      flags: { realityCheckMinutes: 60, excludedUntil: null },
    });
    expect(playerSchema.parse(player)).toEqual(player);
  });

  it("leaves out what the API did not say, rather than inventing it", () => {
    const me = example("/v1/me");
    delete me.date_of_birth;
    delete me.can_withdraw;
    delete me.flags;
    delete me.marketing_consent;
    delete me.created_at;
    expect(toPlayer(me)).toMatchObject({
      dateOfBirth: null,
      canWithdraw: null,
      marketingConsent: null,
      createdAt: null,
      flags: { realityCheckMinutes: null, excludedUntil: null },
    });
  });

  it("maps the login 200 example to a player summary", () => {
    const result = responseExample("/v1/auth/login", "post", 200) as AuthResult;
    expect(toPlayerSummary(result.player)).toEqual({
      id: "01J9A7R0000000000000000001",
      phone: "+251911234567",
      fullName: "Abebe Kebede",
      kycStatus: "verified",
      language: "am",
    });
    expect(
      loginResultSchema.parse({
        status: "ok",
        player: toPlayerSummary(result.player),
      }).status,
    ).toBe("ok");
  });

  it("maps the login 202 example to an OTP challenge (AC-6)", () => {
    const required = responseExample(
      "/v1/auth/login",
      "post",
      202,
    ) as OtpRequired;
    const result = toOtpRequired(required);
    expect(result).toEqual({
      status: "otp_required",
      challengeId: "01J9A7QK3M8X2B7Y4Z5N6P0R1T",
      expiresIn: 300,
    });
    expect(loginResultSchema.parse(result)).toEqual(result);
  });

  it("builds the contract's login request from the form and this browser's device", () => {
    expect(
      toLoginRequest(
        { phone: "911234567", password: "correct horse battery" },
        DEVICE,
      ),
    ).toEqual(requestExample("/v1/auth/login", "post"));
  });

  it("sends the challenge and the code on the second call (AC-6)", () => {
    expect(
      toLoginRequest(
        {
          phone: "+251911234567",
          password: "correct horse battery",
          challengeId: "01J9A7QK3M8X2B7Y4Z5N6P0R1T",
          otp: "482913",
        },
        DEVICE,
      ),
    ).toEqual({
      ...(requestExample("/v1/auth/login", "post") as object),
      challenge_id: "01J9A7QK3M8X2B7Y4Z5N6P0R1T",
      otp: "482913",
    });
  });
});

describe("registration and reset mappers (F4b)", () => {
  it("builds the contract's OTP request with the phone as +251…", () => {
    expect(toOtpRequest({ phone: "911234567", purpose: "register" })).toEqual(
      requestExample("/v1/auth/otp", "post"),
    );
    expect(toOtpRequest({ phone: "0911 234 567", purpose: "reset" })).toEqual({
      phone: "+251911234567",
      purpose: "reset",
    });
  });

  it("maps the contract's OTP challenge example", () => {
    const view = toOtpChallenge(
      responseExample("/v1/auth/otp", "post", 202) as OtpChallenge,
    );
    expect(view).toEqual({
      challengeId: "01J9A7QK3M8X2B7Y4Z5N6P0R1S",
      expiresIn: 300,
      resendAfter: 60,
    });
    expect(otpChallengeSchema.parse(view)).toEqual(view);
  });

  it("builds RegisterRequest from the form, the tenant's terms, the language and this browser (AC-1)", () => {
    const contract = requestExample(
      "/v1/auth/register",
      "post",
    ) as RegisterRequest;
    const request = toRegisterRequest(
      {
        challengeId: contract.challenge_id,
        otp: contract.otp,
        fullName: "  Abebe Kebede ",
        dateOfBirth: contract.date_of_birth,
        password: contract.password,
        acceptTerms: true,
      },
      contract.accept_terms_version,
      "am",
      DEVICE,
    );
    // The contract's example, minus what F4b does not ask at sign-up.
    const asked: Partial<RegisterRequest> = { ...contract };
    delete asked.national_id;
    delete asked.deposit_limit;
    delete asked.promo_code;
    expect(request).toEqual({ ...asked, marketing_consent: false });
  });

  it("maps the register 201 example to who was created", () => {
    const result = responseExample(
      "/v1/auth/register",
      "post",
      201,
    ) as AuthResult;
    const view = { player: toPlayerSummary(result.player) };
    expect(registerResultSchema.parse(view)).toEqual({
      player: {
        id: "01J9A7R0000000000000000001",
        phone: "+251911234567",
        fullName: "Abebe Kebede",
        kycStatus: "unverified",
        language: "am",
      },
    });
  });

  it("builds the contract's password reset request (AC-9)", () => {
    expect(
      toPasswordResetRequest({
        challengeId: "01J9A7QK3M8X2B7Y4Z5N6P0R1U",
        otp: "551203",
        newPassword: "another long passphrase",
      }),
    ).toEqual(requestExample("/v1/auth/password/reset", "post"));
  });
});

describe("KYC mappers (F4b)", () => {
  it("builds the contract's Fayda requests", () => {
    expect(toFaydaStartRequest({ faydaNumber: "FIN1234567890" })).toEqual(
      requestExample("/v1/kyc/fayda/otp", "post"),
    );
    expect(
      toFaydaVerifyRequest({
        caseId: "01J9A7T0000000000000000001",
        otp: "123456",
      }),
    ).toEqual(requestExample("/v1/kyc/fayda/verify", "post"));
  });

  it("maps the contract's Fayda challenge, keeping the API's masked phone", () => {
    const view = toFaydaChallenge(
      responseExample("/v1/kyc/fayda/otp", "post", 202) as FaydaChallenge,
    );
    expect(view).toEqual({
      caseId: "01J9A7T0000000000000000001",
      otpSentTo: "+2519••••567",
      expiresIn: 300,
    });
    expect(faydaChallengeSchema.parse(view)).toEqual(view);
  });

  it("maps every KycResult example the contract names (AC-10)", () => {
    const result = (name: string) =>
      toKycResult(
        responseExample("/v1/kyc/fayda/verify", "post", 200, name) as KycResult,
      );
    expect(result("verified")).toEqual({
      status: "verified",
      reasonCode: null,
    });
    expect(result("pending")).toEqual({ status: "pending", reasonCode: null });
    expect(result("needs_info")).toEqual({
      status: "needs_info",
      reasonCode: "NAME_MISMATCH",
    });
    for (const name of ["verified", "pending", "needs_info"]) {
      expect(kycResultSchema.parse(result(name))).toEqual(result(name));
    }
    // `rejected` has no example; the schema takes it all the same.
    expect(toKycResult({ status: "rejected", reason_code: "OTHER" })).toEqual({
      status: "rejected",
      reasonCode: "OTHER",
    });
  });
});
