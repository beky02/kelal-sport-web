"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useLongDateTimeText } from "@/lib/i18n/use-long-date-time-text";
import { routes } from "@/config/routes";
import { useSession } from "@/features/auth/hooks/use-session";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { useBreak } from "@/features/responsible-gaming/hooks/use-responsible-gaming";
import {
  useDepositAttempt,
  useDepositIntents,
  usePaymentMethods,
} from "../hooks/use-payments";
import { amountProblem, typedAmount } from "../lib/amount";
import { depositRefusal, sameDeposit, type DepositFix } from "../lib/deposit";
import { goToProvider, rememberDeposit } from "../lib/provider-redirect";
import { ownIntents, useDepositStore } from "../stores/deposit.store";
import type {
  Deposit,
  DepositRequest,
  FlowStep,
  PaymentMethodCode,
} from "../types";
import { WALLET_FLOW } from "../types";
import { AmountStep } from "./AmountStep";
import { ConfirmStep } from "./ConfirmStep";
import { DepositRefused, DepositUnanswered } from "./DepositAlert";
import { DepositPaused } from "./DepositPaused";
import { DepositStatus } from "./DepositStatus";
import { FlowHeader } from "./FlowHeader";
import { MethodStep } from "./MethodStep";

/** The design's starting amount. */
const DEFAULT_AMOUNT = "500";

/**
 * A deposit, for the signed-in player `owner`: method → amount → confirm →
 * where it stands. Keyed by the player where it is used, so another player
 * signing in starts afresh and never sees this one's deposit.
 *
 * Confirm and pay starts one deposit intent with one `Idempotency-Key`
 * (`useDepositAttempt`). The answer says what happens next: the provider's
 * page (followed at once), a push to approve on the phone, or another method.
 *
 * The player can leave at any point and come back: the flow opens on what is
 * still theirs to finish (`deposit.store.ts`) — a deposit that started while
 * they were away, or the one that had no answer or is still on its way —
 * so coming back never starts a second deposit by accident.
 */
export function DepositFlow({
  owner,
  resumeId,
  onExit,
}: {
  owner: string;
  /** A deposit to show straight away: the one this tab left to pay. */
  resumeId: string | null;
  onExit: () => void;
}) {
  const t = useTranslation();
  const router = useRouter();
  const endText = useLongDateTimeText();
  const { kycVerified, canWithdraw } = useSession();
  // A break the player took, as /api/me reports it: no deposit starts.
  const pause = useBreak();
  const openAuth = useAuthStore((s) => s.open);
  const methods = usePaymentMethods(true);
  const attempt = useDepositAttempt(owner);
  const { unseen } = useDepositIntents(owner);

  // Where the flow opens.
  const [opening] = useState(() => {
    const mine = ownIntents(useDepositStore.getState().intents, owner);
    const pending = mine.sending ?? mine.unanswered;
    return {
      shown: resumeId ?? mine.unseen,
      code: pending?.request.method ?? null,
      amount: pending?.request.amount ?? DEFAULT_AMOUNT,
      step: (pending ? "confirm" : "method") as FlowStep,
    };
  });
  const [step, setStep] = useState<FlowStep>(opening.step);
  const [code, setCode] = useState<PaymentMethodCode | null>(opening.code);
  const [amount, setAmount] = useState(opening.amount);
  /** The deposit on screen, if one is. */
  const [shown, setShown] = useState<string | null>(opening.shown);

  // A deposit that starts while the flow is on screen — one already on its
  // way when the player came back — is shown as it lands.
  const [lastUnseen, setLastUnseen] = useState(unseen);
  if (unseen !== lastUnseen) {
    setLastUnseen(unseen);
    if (unseen !== null && shown === null) setShown(unseen);
  }

  // On screen: no longer news when the player comes back.
  useEffect(() => {
    if (shown !== null) useDepositStore.getState().seen(shown);
  }, [shown]);

  // Back from the provider: followed until the API decides, wherever the
  // player goes from here.
  useEffect(() => {
    if (resumeId) useDepositStore.getState().follow(owner, resumeId);
  }, [owner, resumeId]);

  const method = methods.data?.find((m) => m.code === code) ?? null;
  const typed = typedAmount(amount);
  const request: DepositRequest | null =
    method && typed ? { method: method.code, amount: typed } : null;
  // What is on screen: a deposit, else the step — an amount or confirm step
  // needs a method the API offers; without one (a deposit retried with a
  // method no longer listed) the player picks again.
  const display: FlowStep =
    shown !== null
      ? "result"
      : (step === "amount" || step === "confirm") && !method
        ? "method"
        : step;

  // Read here, in this render, so the flow re-renders when they change (a
  // query result re-renders only for what its own render read).
  const offeredMethods = methods.data;
  const methodsSettled = !methods.isPending;
  /** A method's name, null while the methods are still being read. */
  const name = (c: PaymentMethodCode): string | null =>
    offeredMethods?.find((m) => m.code === c)?.name ??
    (methodsSettled ? t.t("deposit.provider") : null);

  const started = (deposit: Deposit) => {
    setShown(deposit.id);
    if (deposit.nextAction?.type === "redirect") {
      // Off to the provider's page; the return finds this deposit again.
      rememberDeposit(deposit.id, owner);
      goToProvider(deposit.nextAction.url);
    }
  };

  const confirm = () => {
    if (request) attempt.confirm(request, started);
  };

  /** Back to an earlier step for a new intent: the last answer no longer applies. */
  const restart = (next: FlowStep, from?: Deposit) => {
    attempt.dismiss();
    let to = next;
    if (from) {
      setCode(next === "method" ? null : from.method);
      setAmount(from.amount);
      // The method's limits may have moved since: the amount step says so.
      const offered = methods.data?.find((m) => m.code === from.method);
      if (
        next === "confirm" &&
        offered &&
        amountProblem(from.amount, offered.deposit) !== null
      ) {
        to = "amount";
      }
    }
    setShown(null);
    setStep(to);
  };

  /** Starts a deposit of `amount` with this method: a new intent, a new key. */
  const depositNow = (value: string) => {
    if (!method) return;
    setAmount(value);
    attempt.confirm({ method: method.code, amount: value }, started);
  };

  const fix = (chosen: DepositFix) => {
    switch (chosen.kind) {
      case "chooseMethod":
        return restart("method");
      case "amount":
        // The amount the API allows, as the button says: a new intent.
        return depositNow(chosen.amount);
      case "changeAmount":
        return restart("amount");
      case "retry":
        // The API answered a first try: a new intent, a new key.
        if (request) depositNow(request.amount);
        return;
      case "viewLimits":
        return router.push(routes.responsibleGaming);
      case "verify":
        return openAuth("verify");
    }
  };

  const sending = attempt.sending !== null;

  /** Leaves the flow. Nothing is cancelled: what is still going is kept. */
  const leave = () => {
    attempt.dismiss();
    setShown(null);
    onExit();
  };

  const goBack = () => {
    const index = WALLET_FLOW.indexOf(display);
    attempt.dismiss();
    if (index > 0) setStep(WALLET_FLOW[index - 1]);
    else onExit();
  };

  // What the last attempts said — only while the request on screen is the one
  // they were about; another method or amount is another intent.
  const isThis = (other: DepositRequest) =>
    request !== null && sameDeposit(other, request);
  const unanswered =
    attempt.unanswered !== null && isThis(attempt.unanswered.request);
  const refusal =
    attempt.refusal && isThis(attempt.refusal.attempt.request)
      ? attempt.refusal
      : null;
  const breakUntil = pause?.until ? endText(pause.until) : null;

  // During a break nothing new starts here — the header's Deposit and the
  // slip's land on this — but a deposit already on its way is still shown,
  // and one that had no answer keeps its Try again: the same key only asks
  // after that deposit, as the slip's Try again does for a bet.
  if (pause && display !== "result" && !(display === "confirm" && unanswered)) {
    return (
      <>
        <FlowHeader
          title={t.t("wallet.deposit")}
          step="result"
          onBack={leave}
          backLabel={t.t("auth.back")}
        />
        <DepositPaused until={breakUntil} onBack={leave} />
      </>
    );
  }

  return (
    <>
      <FlowHeader
        title={t.t("wallet.deposit")}
        step={display}
        onBack={display === "result" ? leave : goBack}
        backLabel={t.t("auth.back")}
        locked={sending && display !== "result"}
      />

      {display === "method" && (
        <MethodStep
          mode="deposit"
          kycVerified={kycVerified}
          canWithdraw={canWithdraw}
          selected={code}
          onSelect={setCode}
          onContinue={() => setStep("amount")}
          onVerify={() => openAuth("verify")}
          onBack={onExit}
        />
      )}

      {display === "amount" && method && (
        <AmountStep
          mode="deposit"
          method={method}
          amount={amount}
          onAmountChange={setAmount}
          onContinue={() => setStep("confirm")}
        />
      )}

      {display === "confirm" && method && request && (
        <ConfirmStep
          mode="deposit"
          method={method}
          amount={request.amount}
          sending={sending}
          // A method that's down, or a no the API gave this very request:
          // its fixes are the way on. A Try again's no leaves Try again.
          disabled={!method.available || (refusal !== null && !refusal.retried)}
          confirmLabel={
            unanswered
              ? t.t("deposit.retry", { amount: t.money(request.amount) })
              : t.t("wallet.confirmDeposit")
          }
          // A deposit that may have started can't be cancelled: leaving
          // says where it goes, and coming back finds it again.
          cancelLabel={unanswered ? t.t("deposit.backToWallet") : undefined}
          onConfirm={confirm}
          onCancel={leave}
        >
          {refusal ? (
            <DepositRefused
              notice={depositRefusal(refusal.error, {
                method,
                amount: request.amount,
                breakUntil,
                retried: refusal.retried,
              })}
              onFix={fix}
            />
          ) : (
            unanswered && <DepositUnanswered />
          )}
        </ConfirmStep>
      )}

      {display === "result" && shown && (
        <DepositStatus
          id={shown}
          owner={owner}
          methodName={name}
          onDone={leave}
          onBackToSports={() => router.push(routes.home)}
          onRetry={(deposit) => restart("confirm", deposit)}
          onChooseAnother={(deposit) => restart("method", deposit)}
        />
      )}
    </>
  );
}
