import { DEVICE_SIGNATURE, DEVICE_TIMESTAMP, type SignedCall } from "./calls";

/**
 * Signing a terminal call with the device key (D3, C19 §12): a stolen token is
 * useless without the PC that holds the key.
 *
 * The contract names the signed string, `METHOD\nPATH\nTIMESTAMP\nSHA256(body)`,
 * but not its encodings. Until contract request 014 settles them, this is what
 * is sent, and it is all in `canonicalRequest` and `signRequest`:
 *
 * - METHOD upper case; PATH the API's path as sent (with any query string);
 *   TIMESTAMP the `X-Device-Timestamp` value;
 * - the body's SHA-256 as lowercase hex, of zero bytes when there is none;
 * - the signature as WebCrypto returns it — the 64-byte IEEE P1363 `r‖s` —
 *   in standard, padded base64.
 */

/** SHA-256 of zero bytes: what a call without a body signs. */
export const EMPTY_BODY_SHA256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

const hex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

const base64 = (bytes: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)));

/** The lowercase hex SHA-256 of a body's UTF-8 bytes. */
export async function sha256Hex(body: string): Promise<string> {
  return hex(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body)),
  );
}

/** The string the device key signs (`DeviceSignature` in the contract). */
export const canonicalRequest = (
  method: string,
  path: string,
  timestamp: number,
  bodySha256: string,
): string => `${method}\n${path}\n${timestamp}\n${bodySha256}`;

/**
 * The two headers that sign `call` — the API's method and path, never this
 * app's route — over `body`, the exact bytes that will go upstream, at `now`
 * (this PC's clock, corrected by the server's when it was off).
 */
export async function signRequest(
  privateKey: CryptoKey,
  call: Pick<SignedCall, "method" | "api">,
  { body, now }: { body: string; now: number },
): Promise<Record<typeof DEVICE_TIMESTAMP | typeof DEVICE_SIGNATURE, string>> {
  const timestamp = Math.round(now);
  const text = canonicalRequest(
    call.method,
    call.api,
    timestamp,
    body === "" ? EMPTY_BODY_SHA256 : await sha256Hex(body),
  );
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(text),
  );
  return {
    [DEVICE_TIMESTAMP]: String(timestamp),
    [DEVICE_SIGNATURE]: base64(signature),
  };
}
