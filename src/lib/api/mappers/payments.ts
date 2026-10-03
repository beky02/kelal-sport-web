import {
  PAYMENT_METHOD_CODES,
  type Deposit,
  type DepositNextAction,
  type DepositRequest,
  type PaymentFlow,
  type PaymentMethod,
  type PaymentMethodCode,
} from "@/features/wallet/types";
import type { components } from "@/lib/api/schema";

type ApiPaymentMethod = components["schemas"]["PaymentMethod"];
type ApiDeposit = components["schemas"]["Deposit"];
type ApiNextAction = components["schemas"]["NextAction"];
type ApiDepositRequest = components["schemas"]["DepositRequest"];

const isMethodCode = (code: string): code is PaymentMethodCode =>
  (PAYMENT_METHOD_CODES as readonly string[]).includes(code);

const FLOWS: readonly string[] = ["app_or_web", "redirect", "ussd_push"];
const toFlow = (flow: string): PaymentFlow =>
  FLOWS.includes(flow) ? (flow as PaymentFlow) : "other";

/**
 * `/v1/payment-methods` → the methods a player can pick, limits untouched. A
 * code the contract adds after this build is left out: a deposit is sent with
 * one of the contract's codes, so it could not be chosen anyway.
 */
export function toPaymentMethods(
  items: readonly ApiPaymentMethod[],
): PaymentMethod[] {
  return items
    .filter((method) => isMethodCode(method.code))
    .map((method) => ({
      code: method.code,
      name: method.name,
      flow: toFlow(method.flow),
      available: method.available,
      deposit: { min: method.deposit.min, max: method.deposit.max },
      withdrawal: method.withdrawal
        ? { min: method.withdrawal.min, max: method.withdrawal.max }
        : null,
    }));
}

/**
 * What the player does next, as this site can follow it. A redirect goes
 * through only when `isAllowed` says its page may be visited — otherwise the
 * URL never leaves the server. App-only payments and kinds the contract adds
 * later can't be finished on the website.
 */
function toNextAction(
  action: ApiNextAction | null | undefined,
  isAllowed: (url: string) => boolean,
): DepositNextAction | null {
  if (!action) return null;
  switch (action.type) {
    case "redirect":
      return action.url && isAllowed(action.url)
        ? { type: "redirect", url: action.url }
        : { type: "unsupported", reason: "redirect_refused" };
    case "ussd_push":
      return { type: "ussd_push", message: action.message ?? null };
    case "app_sdk":
      return { type: "unsupported", reason: "app_sdk" };
    default:
      return { type: "unsupported", reason: "unknown" };
  }
}

/**
 * A deposit as the screens show it. The amount is the API's string; times
 * and the failure reason are null when the API didn't send them.
 */
export function toDeposit(
  deposit: ApiDeposit,
  isAllowed: (url: string) => boolean,
): Deposit {
  return {
    id: deposit.id,
    method: deposit.method,
    amount: deposit.amount,
    status: deposit.status,
    nextAction: toNextAction(deposit.next_action, isAllowed),
    failureReason: deposit.failure_reason ?? null,
    expiresAt: deposit.expires_at ?? null,
    createdAt: deposit.created_at,
    completedAt: deposit.completed_at ?? null,
  };
}

/**
 * The player's request as the API takes it, with where the provider sends
 * them back — this site's own address, built on the server, never the
 * browser's.
 */
export const toDepositRequest = (
  request: DepositRequest,
  returnUrl: string,
): ApiDepositRequest => ({
  method: request.method,
  amount: request.amount,
  return_url: returnUrl,
});
