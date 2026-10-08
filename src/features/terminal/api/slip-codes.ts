import { toSlipCodeCreate } from "@/lib/api/mappers/terminal";
import { slipCodeReceiptSchema } from "@/lib/api/terminal-schemas";
import { TERMINAL_CALLS } from "../lib/calls";
import { deviceKeyStore } from "../lib/device-key";
import type { SlipCodeReceipt, SlipCodeRequest } from "../types";
import { terminalRequest } from "./client";

/**
 * Book bet on the kiosk (F8cc): the slip as the contract's `SlipCodeCreate`, made here
 * because the device key signs the exact text the API will receive (D3; F8b
 * decision 2), sent to `/api/terminal/slip-codes` with the intent's
 * `Idempotency-Key`. Without a key in this browser nothing is sent: the
 * terminal is not activated here, which its status then says.
 */
export async function createSlipCode(
  request: SlipCodeRequest,
  idempotencyKey: string,
): Promise<SlipCodeReceipt> {
  const pair = await deviceKeyStore.load();
  return terminalRequest(TERMINAL_CALLS.slipCodes, slipCodeReceiptSchema, {
    body: toSlipCodeCreate(request),
    key: pair?.privateKey,
    idempotencyKey,
  });
}
