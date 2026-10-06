/**
 * The terminal's device key (C19 §4.1, D3): an ECDSA P-256 key pair made in
 * this browser at activation. Its private half is non-extractable — no script,
 * this app's included, can read it out, only ask WebCrypto to sign with it —
 * and it stays in IndexedDB, which keeps a `CryptoKey` as a handle, not as
 * bytes. Its public half goes to the API once, with the activation code.
 */

const ALGORITHM: EcKeyGenParams = { name: "ECDSA", namedCurve: "P-256" };

/**
 * This browser could not make or keep the device key (no WebCrypto, IndexedDB
 * refused): the terminal can't run here, whatever the server says.
 */
export class DeviceKeyError extends Error {
  constructor(readonly cause: unknown) {
    super("This browser can't make or keep the terminal's device key");
    this.name = "DeviceKeyError";
  }
}

/** A fresh key pair whose private half can never be exported. */
export async function createDeviceKey(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(ALGORITHM, false, ["sign", "verify"]);
}

/** The public half as the contract's `device_public_key`: SPKI, base64. */
export async function publicKeyBase64(pair: CryptoKeyPair): Promise<string> {
  const spki = await crypto.subtle.exportKey("spki", pair.publicKey);
  return btoa(String.fromCharCode(...new Uint8Array(spki)));
}

/** Where the key pair lives between boots. */
export interface DeviceKeyStore {
  /** The stored pair, or null when there is none or it can't be read. */
  load(): Promise<CryptoKeyPair | null>;
  /** Replaces the stored pair; throws when the browser can't keep it. */
  save(pair: CryptoKeyPair): Promise<void>;
}

const DATABASE = "kelal-terminal";
const STORE = "keys";
const ENTRY = "device";

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** One IndexedDB request in its own transaction, closed when done. */
async function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const db = await database();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = action(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request.result as T);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

const isKeyPair = (value: unknown): value is CryptoKeyPair =>
  typeof value === "object" &&
  value !== null &&
  (value as CryptoKeyPair).privateKey instanceof CryptoKey &&
  (value as CryptoKeyPair).publicKey instanceof CryptoKey;

/** The key pair in this browser's IndexedDB. */
export const deviceKeyStore: DeviceKeyStore = {
  async load() {
    try {
      const value = await run<unknown>("readonly", (store) => store.get(ENTRY));
      return isKeyPair(value) ? value : null;
    } catch {
      return null;
    }
  },
  async save(pair) {
    await run("readwrite", (store) => store.put(pair, ENTRY));
  },
};
