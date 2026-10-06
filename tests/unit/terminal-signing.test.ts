import { describe, expect, it } from "vitest";
import { normaliseActivationCode } from "@/features/terminal/lib/code";
import { TERMINAL_CALLS } from "@/features/terminal/lib/calls";
import {
  createDeviceKey,
  publicKeyBase64,
} from "@/features/terminal/lib/device-key";
import {
  EMPTY_BODY_SHA256,
  canonicalRequest,
  sha256Hex,
  signRequest,
} from "@/features/terminal/lib/signing";
import { P256_SPKI_BASE64 } from "@/lib/api/schemas";

const NOW = Date.parse("2026-10-06T09:00:00Z");

const fromBase64 = (text: string) =>
  Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

/** Whether `signature` is the device key's over exactly `text`. */
const verifies = (publicKey: CryptoKey, signature: string, text: string) =>
  crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    fromBase64(signature),
    new TextEncoder().encode(text),
  );

describe("the device key (AC-2)", () => {
  it("makes a device key whose private half can't be exported", async () => {
    const pair = await createDeviceKey();

    expect(pair.privateKey.extractable).toBe(false);
    expect(pair.privateKey.algorithm).toMatchObject({
      name: "ECDSA",
      namedCurve: "P-256",
    });
    expect(pair.privateKey.usages).toEqual(["sign"]);
    await expect(
      crypto.subtle.exportKey("pkcs8", pair.privateKey),
    ).rejects.toThrow();
    await expect(
      crypto.subtle.exportKey("jwk", pair.privateKey),
    ).rejects.toThrow();

    // Its public half is what activation sends: a P-256 SPKI, base64.
    const spki = await publicKeyBase64(pair);
    expect(spki).toMatch(P256_SPKI_BASE64);
    expect(fromBase64(spki)).toHaveLength(91);
  });
});

describe("signing a terminal call (AC-2)", () => {
  it("hashes the body as lowercase hex SHA-256, and no body as zero bytes", async () => {
    expect(await sha256Hex("")).toBe(EMPTY_BODY_SHA256);
    expect(EMPTY_BODY_SHA256).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(await sha256Hex('{"a":1}')).toBe(
      "015abd7f5cc57a2dd94b7590f04ad8084273905ee33ec5cebeae62276a97f862",
    );
  });

  it("builds the string the contract names: METHOD, PATH, TIMESTAMP and the body's hash, one per line", () => {
    expect(
      canonicalRequest("GET", "/v1/retail/terminal", NOW, EMPTY_BODY_SHA256),
    ).toBe(`GET\n/v1/retail/terminal\n${NOW}\n${EMPTY_BODY_SHA256}`);
  });

  it("signs the API's method, path, timestamp and body hash, verifiable with the public key", async () => {
    const pair = await createDeviceKey();

    for (const call of [TERMINAL_CALLS.status, TERMINAL_CALLS.token]) {
      const headers = await signRequest(pair.privateKey, call, {
        body: "",
        now: NOW,
      });
      expect(headers["X-Device-Timestamp"]).toBe(String(NOW));
      // WebCrypto's 64-byte r‖s, standard base64.
      expect(headers["X-Device-Signature"]).toMatch(/^[A-Za-z0-9+/]{86}==$/);

      const signed = canonicalRequest(
        call.method,
        call.api,
        NOW,
        EMPTY_BODY_SHA256,
      );
      expect(
        await verifies(pair.publicKey, headers["X-Device-Signature"], signed),
      ).toBe(true);
      // The API's path, never this app's own route.
      expect(
        await verifies(
          pair.publicKey,
          headers["X-Device-Signature"],
          canonicalRequest(call.method, call.route, NOW, EMPTY_BODY_SHA256),
        ),
      ).toBe(false);
      // Another time, method or body is another request.
      for (const other of [
        canonicalRequest(call.method, call.api, NOW + 1, EMPTY_BODY_SHA256),
        canonicalRequest(
          call.method === "GET" ? "POST" : "GET",
          call.api,
          NOW,
          EMPTY_BODY_SHA256,
        ),
        canonicalRequest(call.method, call.api, NOW, await sha256Hex("{}")),
      ]) {
        expect(
          await verifies(pair.publicKey, headers["X-Device-Signature"], other),
        ).toBe(false);
      }
    }
  });

  it("covers the exact body bytes it was given", async () => {
    const pair = await createDeviceKey();
    const body = '{"bet_type":"single","legs":[{"outcome_id":"oc_1"}]}';
    const headers = await signRequest(pair.privateKey, TERMINAL_CALLS.token, {
      body,
      now: NOW,
    });
    const text = (hash: string) =>
      canonicalRequest("POST", TERMINAL_CALLS.token.api, NOW, hash);
    expect(
      await verifies(
        pair.publicKey,
        headers["X-Device-Signature"],
        text(await sha256Hex(body)),
      ),
    ).toBe(true);
    expect(
      await verifies(
        pair.publicKey,
        headers["X-Device-Signature"],
        text(await sha256Hex(`${body} `)),
      ),
    ).toBe(false);
  });
});

describe("the activation code as typed", () => {
  it("forgives case, spaces, hyphens and the letters Crockford reads as digits", () => {
    expect(normaliseActivationCode("K7Q2M9XP")).toBe("K7Q2M9XP");
    expect(normaliseActivationCode(" k7q2-m9xp ")).toBe("K7Q2M9XP");
    expect(normaliseActivationCode("k7q2 m9xp")).toBe("K7Q2M9XP");
    expect(normaliseActivationCode("OIL2M9XP")).toBe("0112M9XP");
  });

  it("is null for anything that isn't 8 Crockford characters", () => {
    for (const raw of ["", "K7Q2M9X", "K7Q2M9XPA", "K7Q2M9XU", "K7Q2M9X!"]) {
      expect(normaliseActivationCode(raw), raw).toBeNull();
    }
  });
});
