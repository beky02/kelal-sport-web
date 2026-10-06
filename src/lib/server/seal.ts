import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import type { z } from "zod";
import { sessionSecret, sessionSecrets } from "./config";

/**
 * Seals a value into a cookie the browser carries but can neither read nor
 * forge (09-security, "The session cookie"): AES-256-GCM, a fresh 96-bit
 * nonce per seal, the key derived from `SESSION_SECRET` by HKDF-SHA256 with
 * the cookie's **purpose** as info. A purpose is a cookie and its version
 * (`kelal.session.v1`, `kelal.terminal.v1`), so a value sealed for one never
 * opens as another, and the secret serves nothing else. The version is
 * authenticated too (associated data): a `v1` value cannot be presented as
 * another version.
 */
export interface Purpose {
  /** HKDF info: what the key is for. */
  info: string;
  /** The value's first segment, also its associated data. */
  version: string;
}

const keyFor = (secret: string, { info }: Purpose) =>
  Buffer.from(hkdfSync("sha256", secret, "", info, 32));
const encode = (bytes: Buffer) => bytes.toString("base64url");
const decode = (text: string) => Buffer.from(text, "base64url");

/** `version.iv.ciphertext.tag`, every part base64url. */
export function sealJson(
  purpose: Purpose,
  value: unknown,
  secret: string = sessionSecret(),
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFor(secret, purpose), iv);
  cipher.setAAD(Buffer.from(purpose.version, "utf8"));
  const sealed = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(value), "utf8")),
    cipher.final(),
  ]);
  return [
    purpose.version,
    encode(iv),
    encode(sealed),
    encode(cipher.getAuthTag()),
  ].join(".");
}

function openWith<T>(
  purpose: Purpose,
  schema: z.ZodType<T>,
  secret: string,
  [iv, sealed, tag]: [string, string, string],
): T | null {
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      keyFor(secret, purpose),
      decode(iv),
    );
    decipher.setAAD(Buffer.from(purpose.version, "utf8"));
    decipher.setAuthTag(decode(tag));
    const plain = Buffer.concat([
      decipher.update(decode(sealed)),
      decipher.final(),
    ]).toString("utf8");
    const parsed = schema.safeParse(JSON.parse(plain));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * What a sealed value holds, or null for anything tampered, foreign (another
 * purpose, another secret) or stale in shape. Tried with the current secret,
 * then the previous one during a rotation (`sessionSecrets()`), unless a
 * secret is given.
 */
export function openJson<T>(
  purpose: Purpose,
  schema: z.ZodType<T>,
  value: string,
  secret?: string,
): T | null {
  const [version, iv, sealed, tag, ...rest] = value.split(".");
  if (version !== purpose.version || !iv || !sealed || !tag || rest.length) {
    return null;
  }
  for (const candidate of secret ? [secret] : sessionSecrets()) {
    const opened = openWith(purpose, schema, candidate, [iv, sealed, tag]);
    if (opened) return opened;
  }
  return null;
}
