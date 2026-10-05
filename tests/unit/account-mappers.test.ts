import { describe, expect, it } from "vitest";
import { toDeviceSessions, toMePatch } from "@/lib/api/mappers/account";
import type { components } from "@/lib/api/schema";
import { accountChangeSchema, deviceSessionsSchema } from "@/lib/api/schemas";
import { example, requestExample } from "../contract";

type ApiSession = components["schemas"]["Session"];

describe("toMePatch (AC-8)", () => {
  it("maps a change to MePatch with only what changed", () => {
    expect(toMePatch({ language: "en" })).toEqual(
      requestExample("/v1/me", "patch"),
    );
    expect(toMePatch({ marketingConsent: false })).toEqual({
      marketing_consent: false,
    });
    expect(toMePatch({ language: "am", marketingConsent: true })).toEqual({
      language: "am",
      marketing_consent: true,
    });
  });

  it("accepts from the browser a language or a consent, at least one, nothing else", () => {
    expect(accountChangeSchema.safeParse({ language: "am" }).success).toBe(
      true,
    );
    expect(
      accountChangeSchema.safeParse({ marketingConsent: true }).success,
    ).toBe(true);
    for (const refused of [
      {},
      { language: "fr" },
      { language: null },
      { marketingConsent: "yes" },
      { marketing_consent: true },
      { language: "en", fullName: "Someone Else" },
      { language: "en", realityCheckMinutes: 5 },
      null,
      [],
    ]) {
      expect(
        accountChangeSchema.safeParse(refused).success,
        JSON.stringify(refused),
      ).toBe(false);
    }
  });
});

describe("toDeviceSessions (AC-9)", () => {
  it("maps the contract's sessions: this device marked, the API's own words", () => {
    const sessions = toDeviceSessions(example("/v1/me/sessions").items);

    expect(sessions).toEqual([
      {
        id: "01J9A7S0000000000000000001",
        platform: "web",
        userAgent: "Chrome 129 on Windows",
        ip: "196.188.x.x",
        createdAt: "2026-10-01T08:15:00Z",
        lastUsedAt: "2026-10-03T12:00:00Z",
        current: true,
      },
      {
        id: "01J9A7S0000000000000000002",
        platform: "android",
        userAgent: "App 1.0.3",
        ip: "196.189.x.x",
        createdAt: "2026-09-28T19:02:00Z",
        lastUsedAt: "2026-10-02T20:41:00Z",
        current: false,
      },
    ]);
    // What the route handler answers is what the browser accepts.
    expect(deviceSessionsSchema.parse(sessions)).toEqual(sessions);
  });

  it("keeps what the API left out as null", () => {
    const [first] = example("/v1/me/sessions").items;
    const bare: ApiSession = {
      id: first.id,
      platform: "ios",
      created_at: first.created_at,
      last_used_at: first.last_used_at,
      current: false,
    };

    expect(toDeviceSessions([bare])).toEqual([
      {
        id: first.id,
        platform: "ios",
        userAgent: null,
        ip: null,
        createdAt: first.created_at,
        lastUsedAt: first.last_used_at,
        current: false,
      },
    ]);
  });
});
