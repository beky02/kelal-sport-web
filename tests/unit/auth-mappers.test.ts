import { describe, expect, it } from "vitest";
import type { components } from "@/lib/api/schema";
import {
  toLoginRequest,
  toOtpRequired,
  toPlayer,
  toPlayerSummary,
} from "@/lib/api/mappers/auth";
import { loginResultSchema, playerSchema } from "@/lib/api/schemas";
import { example, requestExample, responseExample } from "../contract";

type AuthResult = components["schemas"]["AuthResult"];
type OtpRequired = components["schemas"]["OtpRequired"];

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
