import { describe, expect, it } from "vitest";
import {
  toActivateRequest,
  toTerminalActivation,
  toTerminalInfo,
} from "@/lib/api/mappers/terminal";
import type { components } from "@/lib/api/schema";
import { toTerminalConfigView } from "@/lib/api/mappers/config";
import {
  activationFormSchema,
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

  it("maps the contract's config: retail on, the languages, Amharic by default (AC-3, AC-4)", () => {
    const view = toTerminalConfigView(config());
    expect(view).toEqual({
      retail: true,
      languages: ["am", "en"],
      defaultLanguage: "am",
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
});
