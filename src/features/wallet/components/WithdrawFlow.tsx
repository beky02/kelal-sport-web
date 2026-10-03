"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n/use-translation";
import { routes } from "@/config/routes";
import { formatPhone, toE164 } from "@/features/auth/lib/phone";
import { useSession } from "@/features/auth/hooks/use-session";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { usePaymentMethods } from "../hooks/use-payments";
import {
  useWithdrawalAttempt,
  useWithdrawalIntents,
} from "../hooks/use-withdrawals";
import { typedAmount } from "../lib/amount";
import {
  sameWithdrawal,
  withdrawalRefusal,
  type WithdrawalFix,
} from "../lib/withdrawal";
import {
  ownWithdrawalIntents,
  useWithdrawalStore,
  type WithdrawalAttempt,
} from "../stores/withdrawal.store";
import {
  WITHDRAW_FLOW,
  type FlowStep,
  type PaymentMethodCode,
  type Withdrawal,
  type WithdrawalDestination,
  type WithdrawalRequest,
} from "../types";
import { AccountStep, type AccountChoice } from "./AccountStep";
import { AmountStep } from "./AmountStep";
import { ConfirmStep } from "./ConfirmStep";
import { FlowHeader } from "./FlowHeader";
import { MethodStep } from "./MethodStep";
import { WithdrawRefused, WithdrawUnanswered } from "./WithdrawAlert";
import { WithdrawalStatus } from "./WithdrawalStatus";

/** The design's starting amount. */
const DEFAULT_AMOUNT = "500";

/** Where a withdrawal flow starts again from: a method and an amount, and the step. */
export interface WithdrawSeed {
  method: PaymentMethodCode | null;
  amount: string;
  step: "method" | "account";
}

/** What the confirm step showed as the account, from what the request names. */
const choiceOf = (attempt: WithdrawalAttempt): AccountChoice =>
  attempt.request.to.kind === "saved"
    ? {
        kind: "saved",
        id: attempt.request.to.payoutAccountId,
        label: attempt.accountLabel,
      }
    : { kind: "new", digits: attempt.request.to.account };

/** Where the money goes, in the contract's terms; null while a typed number isn't one. */
function destinationOf(
  choice: AccountChoice | null,
): { to: WithdrawalDestination; label: string } | null {
  if (choice?.kind === "saved") {
    return {
      to: { kind: "saved", payoutAccountId: choice.id },
      label: choice.label,
    };
  }
  const number = choice ? toE164(choice.digits) : null;
  return number
    ? { to: { kind: "new", account: number }, label: formatPhone(number) }
    : null;
}

/**
 * A withdrawal, for the signed-in player `owner`: method → account → amount
 * → confirm → where it stands. Keyed by the player where it is used, so
 * another player signing in starts afresh and never sees this one's.
 *
 * Confirm withdrawal sends one intent with one `Idempotency-Key`
 * (`useWithdrawalAttempt`); the answer is the withdrawal the API accepted,
 * and its status screen follows it. The player can leave at any point and
 * come back: the flow opens on what is still theirs to finish
 * (`withdrawal.store.ts`) — a withdrawal accepted while they were away, or
 * the one that had no answer or is still on its way — so coming back never
 * asks for a second withdrawal by accident.
 */
export function WithdrawFlow({
  owner,
  available,
  seed,
  onExit,
}: {
  owner: string;
  /** The cash balance as the API sent it: what a withdrawal can take. */
  available: string;
  /** Where to start: Try again or another method from a withdrawal's screen. */
  seed: WithdrawSeed | null;
  onExit: () => void;
}) {
  const t = useTranslation();
  const router = useRouter();
  const { kycVerified, canWithdraw } = useSession();
  const openAuth = useAuthStore((s) => s.open);
  const methods = usePaymentMethods(true);
  const attempt = useWithdrawalAttempt(owner);
  const { unseen } = useWithdrawalIntents(owner);

  // Where the flow opens.
  const [opening] = useState(() => {
    const mine = ownWithdrawalIntents(
      useWithdrawalStore.getState().intents,
      owner,
    );
    const pending = mine.sending ?? mine.unanswered;
    if (pending) {
      return {
        shown: mine.unseen,
        code: pending.request.method as PaymentMethodCode | null,
        choice: choiceOf(pending) as AccountChoice | null,
        amount: pending.request.amount,
        step: "confirm" as FlowStep,
      };
    }
    return {
      shown: mine.unseen,
      code: seed?.method ?? null,
      choice: null,
      amount: seed?.amount ?? DEFAULT_AMOUNT,
      step: (seed?.step ?? "method") as FlowStep,
    };
  });
  const [step, setStep] = useState<FlowStep>(opening.step);
  const [code, setCode] = useState<PaymentMethodCode | null>(opening.code);
  const [choice, setChoice] = useState<AccountChoice | null>(opening.choice);
  const [amount, setAmount] = useState(opening.amount);
  /** The withdrawal on screen, if one is. */
  const [shown, setShown] = useState<string | null>(opening.shown);

  // A withdrawal accepted while the flow is on screen — one already on its
  // way when the player came back — is shown as it lands.
  const [lastUnseen, setLastUnseen] = useState(unseen);
  if (unseen !== lastUnseen) {
    setLastUnseen(unseen);
    if (unseen !== null && shown === null) setShown(unseen);
  }

  // On screen: no longer news when the player comes back.
  useEffect(() => {
    if (shown !== null) useWithdrawalStore.getState().seen(shown);
  }, [shown]);

  // Only a method that pays out can carry a withdrawal.
  const method =
    methods.data?.find((m) => m.code === code && m.withdrawal !== null) ?? null;
  const destination = destinationOf(choice);
  const typed = typedAmount(amount);
  const request: WithdrawalRequest | null =
    method && destination && typed
      ? { method: method.code, amount: typed, to: destination.to }
      : null;
  // What is on screen: a withdrawal, else the step — each step needs what
  // the ones before it chose; without it (a method no longer offered, a
  // number cleared) the player picks again.
  const display: FlowStep =
    shown !== null
      ? "result"
      : step !== "method" && !method
        ? "method"
        : (step === "amount" || step === "confirm") && !destination
          ? "account"
          : step;

  const started = (withdrawal: Withdrawal) => setShown(withdrawal.id);

  const confirm = () => {
    if (request && destination) {
      attempt.confirm(request, destination.label, started);
    }
  };

  /** Another method: an account of the last one doesn't go with it. */
  const selectMethod = (next: PaymentMethodCode) => {
    if (next !== code) setChoice(null);
    setCode(next);
  };

  /** Back to an earlier step for a new intent: the last answer no longer applies. */
  const restart = (next: FlowStep) => {
    attempt.dismiss();
    setShown(null);
    setStep(next);
  };

  /** Withdraws `value` to the same account with the same method: a new intent, a new key. */
  const withdrawNow = (value: string) => {
    if (!request || !destination) return;
    setAmount(value);
    attempt.confirm({ ...request, amount: value }, destination.label, started);
  };

  const fix = (chosen: WithdrawalFix) => {
    switch (chosen.kind) {
      case "chooseMethod":
        return restart("method");
      case "chooseAccount":
        return restart("account");
      case "amount":
        // The amount the API allows, as the button says: a new intent.
        return withdrawNow(chosen.amount);
      case "changeAmount":
        return restart("amount");
      case "retry":
        // The API answered: a new intent, a new key.
        if (request) withdrawNow(request.amount);
        return;
      case "verify":
        return openAuth("verify");
      case "keepWagering":
        return router.push(routes.home);
      case "help":
        return router.push(routes.help);
    }
  };

  /** Starts again from a withdrawal on screen, with its method and amount. */
  const again = (from: Withdrawal, next: "method" | "account") => {
    setCode(next === "method" ? null : from.method);
    setChoice(null);
    setAmount(from.amount);
    restart(next);
  };

  const sending = attempt.sending !== null;

  /** Leaves the flow. Nothing is cancelled: what is on its way is kept. */
  const leave = () => {
    attempt.dismiss();
    setShown(null);
    onExit();
  };

  const goBack = () => {
    const index = WITHDRAW_FLOW.indexOf(display);
    attempt.dismiss();
    if (index > 0) setStep(WITHDRAW_FLOW[index - 1]);
    else onExit();
  };

  // What the last attempts said — only while the request on screen is the one
  // they were about; another method, account or amount is another intent.
  const isThis = (other: WithdrawalRequest) =>
    request !== null && sameWithdrawal(other, request);
  const unanswered =
    attempt.unanswered !== null && isThis(attempt.unanswered.request);
  const refusal =
    attempt.refusal && isThis(attempt.refusal.attempt.request)
      ? attempt.refusal
      : null;

  return (
    <>
      <FlowHeader
        title={t.t("wallet.withdraw")}
        step={display}
        steps={WITHDRAW_FLOW}
        onBack={display === "result" ? leave : goBack}
        backLabel={t.t("auth.back")}
        locked={sending && display !== "result"}
      />

      {display === "method" && (
        <MethodStep
          mode="withdraw"
          kycVerified={kycVerified}
          canWithdraw={canWithdraw}
          selected={code}
          onSelect={selectMethod}
          onContinue={() => setStep("account")}
          onVerify={() => openAuth("verify")}
          onBack={onExit}
        />
      )}

      {display === "account" && method && (
        <AccountStep
          method={method}
          choice={choice}
          onChoice={setChoice}
          onContinue={() => setStep("amount")}
        />
      )}

      {display === "amount" && method && destination && (
        <AmountStep
          mode="withdraw"
          method={method}
          available={available}
          accountLabel={destination.label}
          amount={amount}
          onAmountChange={setAmount}
          onContinue={() => setStep("confirm")}
        />
      )}

      {display === "confirm" && method && destination && request && (
        <ConfirmStep
          mode="withdraw"
          method={method}
          amount={request.amount}
          accountLabel={destination.label}
          sending={sending}
          // A method that's down, or a no the API gave this very request:
          // its fixes are the way on. A Try again's no leaves Try again.
          disabled={!method.available || (refusal !== null && !refusal.retried)}
          confirmLabel={
            unanswered
              ? t.t("withdraw.retry", { amount: t.money(request.amount) })
              : t.t("wallet.confirmWithdraw")
          }
          // A withdrawal that may have gone through can't be cancelled from
          // here: leaving says where it goes, and coming back finds it again.
          cancelLabel={unanswered ? t.t("deposit.backToWallet") : undefined}
          onConfirm={confirm}
          onCancel={leave}
        >
          {refusal ? (
            <WithdrawRefused
              notice={withdrawalRefusal(refusal.error, {
                method,
                // The method step offers only methods that pay out.
                range: method.withdrawal!,
                amount: request.amount,
                cash: available,
                retried: refusal.retried,
              })}
              onFix={fix}
            />
          ) : (
            unanswered && <WithdrawUnanswered />
          )}
        </ConfirmStep>
      )}

      {display === "result" && shown && (
        <WithdrawalStatus
          id={shown}
          owner={owner}
          onDone={leave}
          onBackToSports={() => router.push(routes.home)}
          onRetry={(withdrawal) => again(withdrawal, "account")}
          onChooseAnother={(withdrawal) => again(withdrawal, "method")}
        />
      )}
    </>
  );
}
