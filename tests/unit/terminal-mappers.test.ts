import { describe, expect, it } from "vitest";
import {
  toActivateRequest,
  toSlipCodeCreate,
  toSlipCodeReceipt,
  toTerminalActivation,
  toTerminalInfo,
} from "@/lib/api/mappers/terminal";
import type { components } from "@/lib/api/schema";
import { toBettingRules, toTerminalConfigView } from "@/lib/api/mappers/config";
import {
  activationFormSchema,
  slipCodeCreateSchema,
  slipCodeReceiptSchema,
  terminalActivationSchema,
  terminalConfigSchema,
  terminalStatusSchema,
} from "@/lib/api/terminal-schemas";
import { example, requestExample, responseExample } from "../contract";

type Activation = components["schemas"]["TerminalActivation"];

/** A real P-256 SPKI in base64, as `crypto.subtle.exportKey("spki")` gives it. */
async function publicKey(): Promise<string> {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign", "verify"],
  );
  const spki = await crypto.subtle.exportKey("spki", pair.publicKey);
  return btoa(String.fromCharCode(...new Uint8Array(spki)));
}

describe("terminal mappers (F8b)", () => {
  it("maps the activation form to the contract's request, with this build's version", () => {
    const contract = requestExample(
      "/v1/retail/terminals/activate",
      "post",
    ) as components["schemas"]["TerminalActivateRequest"];
    expect(
      toActivateRequest(
        {
          activationCode: contract.activation_code,
          devicePublicKey: contract.device_public_key,
        },
        contract.app_version!,
      ),
    ).toEqual(contract);
  });

  it("maps an activation to its shop and label, and leaves the token behind", () => {
    const api = responseExample(
      "/v1/retail/terminals/activate",
      "post",
      200,
    ) as Activation;
    const activation = toTerminalActivation(api);
    expect(activation).toEqual({
      id: "01J9A900000000000000000001",
      label: "PC 3",
      shop: { code: "ADM-004", name: "Adama Kebele 04" },
    });
    expect(JSON.stringify(activation)).not.toContain(api.access_token);
    expect(terminalActivationSchema.parse(activation)).toEqual(activation);
    // The schema itself refuses a token riding along.
    expect(
      terminalActivationSchema.safeParse({
        ...activation,
        accessToken: api.access_token,
      }).success,
    ).toBe(false);
  });

  it("maps the terminal's status, and says null for what the API left out", () => {
    const self = example("/v1/retail/terminal");
    expect(toTerminalInfo(self)).toEqual({
      id: "01J9A900000000000000000001",
      label: "PC 3",
      shop: { code: "ADM-004", name: "Adama Kebele 04", openNow: true },
      idleResetSeconds: 90,
      codeDisplaySeconds: 60,
    });
    const bare = toTerminalInfo({
      terminal_id: self.terminal_id,
      status: "active",
      shop: { ...self.shop, open_now: false },
    });
    expect(bare).toMatchObject({
      label: null,
      idleResetSeconds: null,
      codeDisplaySeconds: null,
      shop: { openNow: false },
    });
    expect(
      terminalStatusSchema.parse({
        state: "active",
        terminal: bare,
        rotateDue: false,
      }),
    ).toBeTruthy();
  });

  it("accepts the contract's code pattern and a P-256 public key, nothing else", async () => {
    const key = await publicKey();
    const ok = { activationCode: "K7Q2M9XP", devicePublicKey: key };
    expect(activationFormSchema.safeParse(ok).success).toBe(true);
    for (const refused of [
      { ...ok, activationCode: "k7q2m9xp" }, // lower case: the screen upper-cases first
      { ...ok, activationCode: "K7Q2M9X" }, // 7 characters
      { ...ok, activationCode: "K7Q2M9XI" }, // I is not Crockford
      { ...ok, activationCode: "K7Q2 M9XP" },
      { ...ok, devicePublicKey: "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE..." },
      { ...ok, devicePublicKey: btoa("not a key") },
      { ...ok, extra: "x" },
      { activationCode: "K7Q2M9XP" },
    ]) {
      expect(
        activationFormSchema.safeParse(refused).success,
        JSON.stringify(refused),
      ).toBe(false);
    }
  });
});

describe("the kiosk's config (F8ca)", () => {
  const config = () => example("/v1/config/public");

  it("maps the contract's config: retail on, the languages, Amharic by default, the shop's rules (AC-3, AC-4)", () => {
    const view = toTerminalConfigView(config());
    expect(view).toEqual({
      retail: true,
      bookingCodes: true,
      languages: ["am", "en"],
      defaultLanguage: "am",
      rules: toBettingRules(config().retail_betting!),
    });
    expect(terminalConfigSchema.parse(view)).toEqual(view);
  });

  it("turns retail off only on an explicit false (AC-4)", () => {
    const others = { ...config().features };
    delete others.retail;
    expect(toTerminalConfigView({ ...config(), features: others }).retail).toBe(
      true,
    );
    expect(
      toTerminalConfigView({
        ...config(),
        features: { ...others, retail: false },
      }).retail,
    ).toBe(false);
  });

  it("turns booking codes off only on an explicit false", () => {
    const withoutFlag = { ...config().features };
    delete withoutFlag.booking_codes;
    expect(
      toTerminalConfigView({ ...config(), features: withoutFlag }).bookingCodes,
    ).toBe(true);
    expect(
      toTerminalConfigView({
        ...config(),
        features: { ...withoutFlag, booking_codes: false },
      }).bookingCodes,
    ).toBe(false);
  });

  it("offers the tenant's own languages, and starts in one of them", () => {
    expect(
      toTerminalConfigView({
        ...config(),
        languages: ["en"],
        default_language: "en",
      }),
    ).toMatchObject({ languages: ["en"], defaultLanguage: "en" });
    // A default the tenant doesn't list falls back to its first language.
    expect(
      toTerminalConfigView({
        ...config(),
        languages: ["en"],
        default_language: "am",
      }).defaultLanguage,
    ).toBe("en");
  });

  it("carries nothing of the online rule set", () => {
    const view = toTerminalConfigView(config());
    expect(view).not.toHaveProperty("betting");
    expect(
      terminalConfigSchema.safeParse({ ...view, betting: {} }).success,
    ).toBe(false);
  });

  it("takes the kiosk's rules from retail_betting, never the online betting (F8cb AC-3)", () => {
    const { betting, retail_betting } = config();
    // The contract's two rule sets differ where the slip shows it: the
    // shop's minimum is 10.00 (online 5.00), and the shop pays no
    // accumulator bonus.
    expect(retail_betting?.min_stake).toBe("10.00");
    expect(betting.min_stake).toBe("5.00");
    expect(retail_betting?.acca_bonus_table).toEqual([]);
    expect(betting.acca_bonus_table.length).toBeGreaterThan(0);

    const { rules } = toTerminalConfigView(config());
    expect(rules).toEqual(toBettingRules(retail_betting!));
    expect(rules).not.toEqual(toBettingRules(betting));
    expect(rules?.calc.min_stake).toBe("10.00");
    // The shop's set has no quick stakes, so the kiosk offers none.
    expect(rules?.quickStakes).toEqual([]);
    expect(
      terminalConfigSchema.parse({
        retail: true,
        bookingCodes: true,
        languages: ["en"],
        defaultLanguage: "en",
        rules,
      }),
    ).toMatchObject({ rules });
  });

  it("has no rules without retail_betting, even with betting (F8cb AC-b2)", () => {
    const withoutRetail = { ...config() };
    delete withoutRetail.retail_betting;
    const view = toTerminalConfigView(withoutRetail);
    expect(withoutRetail.betting).toBeDefined();
    expect(view.rules).toBeNull();
    expect(terminalConfigSchema.parse(view)).toEqual(view);
  });
});

type SlipCodeCreated = components["schemas"]["SlipCodeCreated"];
const CREATED = () =>
  responseExample("/v1/retail/slip-codes", "post", 201) as SlipCodeCreated;

describe("slip codes (F8cc AC-c1)", () => {
  it("builds the contract's slip-code request from the slip, in the contract's order", () => {
    const body = toSlipCodeCreate({
      betType: "multiple",
      systemSizes: [],
      legs: [
        { outcomeId: "oc_ac_1", odds: "2.10" },
        { outcomeId: "oc_sg_1", odds: "1.85" },
      ],
      stakeHint: "50.00",
    });
    // The contract's own example, with the odds the kiosk showed.
    const contract = requestExample("/v1/retail/slip-codes", "post") as {
      legs: { outcome_id: string }[];
    };
    expect(body).toEqual({
      ...contract,
      legs: [
        { ...contract.legs[0], odds: "2.10" },
        { ...contract.legs[1], odds: "1.85" },
      ],
    });
    expect(Object.keys(body)).toEqual(["bet_type", "legs", "stake_hint"]);
    expect(slipCodeCreateSchema.parse(body)).toEqual(body);
  });

  it("leaves out a missing stake hint and empty system sizes, and sends a system's", () => {
    expect(
      toSlipCodeCreate({
        betType: "single",
        systemSizes: [],
        legs: [{ outcomeId: "oc_ac_1", odds: "2.10" }],
        stakeHint: null,
      }),
    ).toEqual({
      bet_type: "single",
      legs: [{ outcome_id: "oc_ac_1", odds: "2.10" }],
    });
    expect(
      Object.keys(
        toSlipCodeCreate({
          betType: "system",
          systemSizes: [2],
          legs: [
            { outcomeId: "a", odds: "1.50" },
            { outcomeId: "b", odds: "1.60" },
            { outcomeId: "c", odds: "1.70" },
          ],
          stakeHint: "30.00",
        }),
      ),
    ).toEqual(["bet_type", "system_sizes", "legs", "stake_hint"]);
  });

  it("maps the contract's 201 example to the code to show", () => {
    const receipt = toSlipCodeReceipt(CREATED());
    expect(receipt).toEqual({
      code: "48291735",
      display: "4829 1735",
      expiresAt: CREATED().expires_at,
      qr: CREATED().qr,
    });
    expect(slipCodeReceiptSchema.parse(receipt)).toEqual(receipt);
  });

  it("never shows other digits than the code's", () => {
    for (const display of ["1234 5678", "4829-1735", "48291735x", ""]) {
      expect(toSlipCodeReceipt({ ...CREATED(), display }).display).toBe(
        "4829 1735",
      );
    }
    expect(
      toSlipCodeReceipt({ ...CREATED(), display: "48 29 17 35" }).display,
    ).toBe("48 29 17 35");
  });

  it("refuses a body the contract wouldn't take, or with anything beside it", () => {
    const valid = toSlipCodeCreate({
      betType: "multiple",
      systemSizes: [],
      legs: [
        { outcomeId: "oc_ac_1", odds: "2.10" },
        { outcomeId: "oc_sg_1", odds: "1.85" },
      ],
      stakeHint: "50.00",
    });
    for (const bad of [
      { ...valid, extra: 1 },
      { ...valid, legs: [] },
      { ...valid, legs: Array(31).fill(valid.legs[0]) },
      { ...valid, legs: [{ outcome_id: "oc_ä" }] },
      { ...valid, legs: [{ outcome_id: "oc_1", odds: "2.1" }] },
      { ...valid, legs: [{ outcome_id: "oc_1", extra: true }] },
      { ...valid, stake_hint: "0.00" },
      { ...valid, stake_hint: "-5.00" },
      { ...valid, stake_hint: "50" },
      { ...valid, bet_type: "accumulator" },
    ]) {
      expect(slipCodeCreateSchema.safeParse(bad).success).toBe(false);
    }
  });
});
