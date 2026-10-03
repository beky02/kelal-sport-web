"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useDateTimeText } from "@/lib/i18n/use-date-time-text";
import { routes } from "@/config/routes";
import { useSession } from "@/features/auth/hooks/use-session";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { useDepositAttempt, usePaymentMethods } from "../hooks/use-payments";
import {
  depositRefusal,
  sameDeposit,
  typedAmount,
  type DepositFix,
} from "../lib/deposit";
import { goToProvider, rememberDeposit } from "../lib/provider-redirect";
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
 * From then on the status screen follows the deposit until the API decides.
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
  const dateTime = useDateTimeText();
  const { kycVerified, canWithdraw, player } = useSession();
  const openAuth = useAuthStore((s) => s.open);
  const methods = usePaymentMethods(true);
  const attempt = useDepositAttempt(owner);

  const [step, setStep] = useState<FlowStep>(resumeId ? "result" : "method");
  const [code, setCode] = useState<PaymentMethodCode | null>(null);
  const [amount, setAmount] = useState(DEFAULT_AMOUNT);
  const [depositId, setDepositId] = useState<string | null>(resumeId);

  const method = methods.data?.find((m) => m.code === code) ?? null;
  // An amount or confirm step needs a method the API offers; without one (a
  // deposit retried with a method no longer listed) the player picks again.
  // One it marks unavailable stays on screen with its refusal, unsendable.
  const shown: FlowStep =
    (step === "amount" || step === "confirm") && !method ? "method" : step;
  const typed = typedAmount(amount);
  const request: DepositRequest | null =
    method && typed ? { method: method.code, amount: typed } : null;

  const name = (c: PaymentMethodCode) =>
    methods.data?.find((m) => m.code === c)?.name ?? c;

  const started = (deposit: Deposit) => {
    setDepositId(deposit.id);
    setStep("result");
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
    attempt.reset();
    if (from) {
      setCode(next === "method" ? null : from.method);
      setAmount(from.amount);
    }
    setDepositId(null);
    setStep(next);
  };

  /** Starts a deposit of `amount` with this method: a new intent, a new key. */
  const depositNow = (amount: string) => {
    if (!method) return;
    setAmount(amount);
    attempt.confirm({ method: method.code, amount }, started);
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
        // The API answered (the provider failed): a new intent, a new key.
        if (request) depositNow(request.amount);
        return;
      case "viewLimits":
        return router.push(routes.responsibleGaming);
      case "verify":
        return openAuth("verify");
    }
  };

  const goBack = () => {
    const index = WALLET_FLOW.indexOf(shown);
    if (index > 0) setStep(WALLET_FLOW[index - 1]);
    else onExit();
  };

  // What the last attempt said — only while the request on screen is the one
  // it was about; a changed method or amount is another intent.
  const state = attempt.state;
  const current =
    request !== null &&
    state.phase !== "idle" &&
    sameDeposit(state.attempt.request, request);
  const unanswered = current && state.phase === "unanswered";
  const refused = current && state.phase === "refused" ? state.error : null;
  const breakUntil = player?.flags.excludedUntil ?? null;

  return (
    <>
      <FlowHeader
        title={t.t("wallet.deposit")}
        step={shown}
        onBack={shown === "result" ? onExit : goBack}
        backLabel={t.t("auth.back")}
      />

      {shown === "method" && (
        <MethodStep
          mode="deposit"
          kycVerified={kycVerified}
          canWithdraw={canWithdraw}
          selected={code}
          onSelect={setCode}
          onContinue={() => setStep("amount")}
          onVerify={() => openAuth("verify")}
        />
      )}

      {shown === "amount" && method && (
        <AmountStep
          mode="deposit"
          method={method}
          amount={amount}
          onAmountChange={setAmount}
          onContinue={() => setStep("confirm")}
        />
      )}

      {shown === "confirm" && method && request && (
        <ConfirmStep
          mode="deposit"
          method={method}
          amount={request.amount}
          sending={state.phase === "sending"}
          disabled={!method.available}
          confirmLabel={
            unanswered
              ? t.t("deposit.retry", { amount: t.money(request.amount) })
              : t.t("wallet.confirmDeposit")
          }
          onConfirm={confirm}
          onCancel={() => {
            attempt.reset();
            onExit();
          }}
        >
          {unanswered && <DepositUnanswered />}
          {refused && (
            <DepositRefused
              notice={depositRefusal(refused, {
                method,
                amount: request.amount,
                breakUntil: breakUntil ? dateTime(breakUntil) : null,
              })}
              onFix={fix}
            />
          )}
        </ConfirmStep>
      )}

      {shown === "result" && depositId && (
        <DepositStatus
          id={depositId}
          owner={owner}
          methodName={name}
          onDone={onExit}
          onBackToSports={() => router.push(routes.home)}
          onRetry={(deposit) => restart("confirm", deposit)}
          onChooseAnother={(deposit) => restart("method", deposit)}
        />
      )}
    </>
  );
}
