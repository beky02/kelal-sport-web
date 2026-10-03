/**
 * A v4 UUID for an `Idempotency-Key`: one per intent — a bet, a deposit —
 * made when the player commits and sent again, unchanged, only when that
 * very request had no answer (TD-01). `crypto.randomUUID` exists only in a
 * secure context, so a phone testing over plain HTTP on the LAN gets the same
 * from `getRandomValues`.
 */
export function newIdempotencyKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}
