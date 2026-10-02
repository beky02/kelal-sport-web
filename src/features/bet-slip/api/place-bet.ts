import { apiClient } from "@/lib/api/client";
import { betReceiptSchema } from "@/lib/api/schemas";
import type { BetReceipt, PlaceBetRequest } from "../types";

/**
 * How long Place waits before saying it couldn't confirm the bet. Placement's
 * own target is 0.8 s (C08 §1); past this the player is offered Try again,
 * which sends the same request with the same key, so a slow answer can never
 * turn into a second bet.
 */
const PLACE_TIMEOUT_MS = 30_000;

/**
 * Places the slip through `/api/bets` (C08).
 *
 * `idempotencyKey` is one per intent (`keyFor`): the same request sent again
 * after no answer carries the same key, so the engine returns the ticket it
 * already issued instead of taking a second stake. The answer is the engine's
 * ticket — every figure the API's.
 */
export function placeBet(
  request: PlaceBetRequest,
  idempotencyKey: string,
): Promise<BetReceipt> {
  return apiClient.post("/bets", betReceiptSchema, request, {
    headers: { "Idempotency-Key": idempotencyKey },
    // Older browsers have no AbortSignal.timeout; they wait for the network.
    signal:
      typeof AbortSignal.timeout === "function"
        ? AbortSignal.timeout(PLACE_TIMEOUT_MS)
        : undefined,
  });
}
