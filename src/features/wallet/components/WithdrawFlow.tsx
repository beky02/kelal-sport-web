"use client";

import { useState } from "react";
import { CircleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n/use-translation";
import { routes } from "@/config/routes";
import { useSession } from "@/features/auth/hooks/use-session";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { usePaymentMethods } from "../hooks/use-payments";
import { useCreateWithdrawal, usePaymentStatus } from "../hooks/use-wallet";
import { typedAmount } from "../lib/deposit";
import {
  WALLET_FLOW,
  type FlowStep,
  type PaymentMethodCode,
  type PaymentResult,
} from "../types";
import { AmountStep } from "./AmountStep";
import { ConfirmStep } from "./ConfirmStep";
import { FlowHeader } from "./FlowHeader";
import { MethodStep } from "./MethodStep";
import { PaymentResultStep } from "./PaymentResultStep";

/**
 * A withdrawal: method → amount → confirm → outcome. The methods and their
 * limits are the API's (`/v1/payment-methods`); the withdrawal itself is the
 * mock until F6c sends it to `/v1/withdrawals`.
 */
export function WithdrawFlow({
  available,
  onExit,
}: {
  /** The cash balance as the API sent it: what a withdrawal can take. */
  available: string;
  onExit: () => void;
}) {
  const t = useTranslation();
  const router = useRouter();
  const { kycVerified, canWithdraw } = useSession();
  const openAuth = useAuthStore((s) => s.open);
  const methods = usePaymentMethods(true);
  const createWithdrawal = useCreateWithdrawal();

  const [step, setStep] = useState<FlowStep>("method");
  const [code, setCode] = useState<PaymentMethodCode | null>(null);
  const [amount, setAmount] = useState("500");
  const [result, setResult] = useState<PaymentResult | null>(null);

  const method = methods.data?.find((m) => m.code === code) ?? null;
  const typed = typedAmount(amount);

  // While the withdrawal sits with the provider, keep asking rather than
  // making the player press something to find out.
  const polling = step === "result" && result !== null;
  const { data: liveStatus } = usePaymentStatus(
    result?.reference ?? null,
    polling,
  );
  // Derived, not synced into state: the answer is the source of truth.
  const settled =
    polling && liveStatus && liveStatus !== "pending" ? liveStatus : null;
  const currentResult =
    result && settled ? { ...result, status: settled } : result;

  const goBack = () => {
    const index = WALLET_FLOW.indexOf(step);
    if (index > 0) setStep(WALLET_FLOW[index - 1]);
    else onExit();
  };

  const submit = () => {
    if (!method || !typed) return;
    createWithdrawal.mutate(
      { method: method.code, amount: typed },
      {
        onSuccess: (payment) => {
          setResult(payment);
          setStep("result");
        },
      },
    );
  };

  return (
    <>
      <FlowHeader
        title={t.t("wallet.withdraw")}
        step={step}
        onBack={step === "result" ? onExit : goBack}
        backLabel={t.t("auth.back")}
      />

      {step === "method" && (
        <MethodStep
          mode="withdraw"
          kycVerified={kycVerified}
          canWithdraw={canWithdraw}
          selected={code}
          onSelect={setCode}
          onContinue={() => setStep("amount")}
          onVerify={() => openAuth("verify")}
        />
      )}

      {step === "amount" && method && (
        <AmountStep
          mode="withdraw"
          method={method}
          available={available}
          amount={amount}
          onAmountChange={setAmount}
          onContinue={() => setStep("confirm")}
        />
      )}

      {step === "confirm" && method && typed && (
        <ConfirmStep
          mode="withdraw"
          method={method}
          amount={typed}
          sending={createWithdrawal.isPending}
          confirmLabel={t.t("wallet.confirmWithdraw")}
          onConfirm={submit}
          onCancel={onExit}
        >
          {createWithdrawal.error && (
            <div
              role="alert"
              className="bg-loss-bg flex items-center gap-2.5 rounded-md p-3"
            >
              <CircleAlert
                size={17}
                strokeWidth={1.5}
                aria-hidden
                className="text-loss shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="font-bold">{t.t("wallet.startFailed")}</div>
                <div className="text-muted text-xs">
                  {createWithdrawal.error.message}
                </div>
              </div>
            </div>
          )}
        </ConfirmStep>
      )}

      {step === "result" && currentResult && method && (
        <PaymentResultStep
          mode="withdraw"
          method={method}
          result={currentResult}
          onDone={onExit}
          onBackToSports={() => router.push(routes.home)}
          onRetry={() => {
            setResult(null);
            setStep("confirm");
          }}
          onChooseAnother={() => {
            setResult(null);
            setStep("method");
          }}
          onCancel={onExit}
        />
      )}
    </>
  );
}
