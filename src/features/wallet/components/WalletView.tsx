"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { StateMessage } from "@/components/feedback/StateMessage";
import { Skeleton } from "@/components/ui/Skeleton";
import { routes } from "@/config/routes";
import { useSession } from "@/features/auth/hooks/use-session";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import {
  useCreatePayment,
  usePaymentStatus,
  useWallet,
} from "../hooks/use-wallet";
import {
  WALLET_FLOW,
  type PaymentMethod,
  type PaymentResult,
  type WalletMode,
  type WalletStep,
} from "../types";
import { AmountStep } from "./AmountStep";
import { ConfirmStep } from "./ConfirmStep";
import { FlowHeader } from "./FlowHeader";
import { MethodStep } from "./MethodStep";
import { PaymentResultStep } from "./PaymentResultStep";
import { WalletGuest } from "./WalletGuest";
import { WalletHome } from "./WalletHome";

/**
 * Deposits and withdrawals.
 *
 * One state machine for both directions, because they ask the same three
 * questions — which method, how much, are you sure — and only differ in which
 * limit binds and which way the money goes. Keeping them as one flow means a fix
 * to the confirmation applies to both.
 */
export function WalletView() {
  const t = useTranslation();
  const router = useRouter();
  const params = useSearchParams();

  // `?action=deposit` lets the header button and the slip's "Deposit to continue"
  // skip the wallet home — both already know what the user came to do.
  const action = params.get("action");
  const requested: WalletMode | null =
    action === "deposit" || action === "withdraw" ? action : null;

  const [step, setStep] = useState<WalletStep>(requested ? "method" : "home");
  const [mode, setMode] = useState<WalletMode>(requested ?? "deposit");
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [amount, setAmount] = useState(500);
  const [result, setResult] = useState<PaymentResult | null>(null);

  // Whether a withdrawal may start is the API's call (`can_withdraw`), read
  // with the session — never a flag kept in the browser.
  const { isLoading, isGuest, kycVerified, canWithdraw } = useSession();
  const openAuth = useAuthStore((s) => s.open);

  // Until /api/me answers, nobody is a guest and nothing is read.
  const wallet = useWallet(!isLoading && !isGuest);
  const balances = wallet.data;
  const createPayment = useCreatePayment();

  // While a payment sits with the provider, keep asking rather than making the
  // user press something to find out.
  const polling = step === "pending" && result !== null;
  const { data: liveStatus } = usePaymentStatus(
    result?.reference ?? null,
    polling,
  );

  // Derived, not synced into state: the provider's answer is the source of truth,
  // and copying it into `step` with an effect would mean rendering the pending
  // screen once more before the real outcome. Clearing `result` on Done or Retry
  // ends the polling, so the derivation hands control back.
  const settled =
    polling && liveStatus && liveStatus !== "pending" ? liveStatus : null;
  const currentStep: WalletStep = settled ?? step;
  const currentResult =
    result && settled ? { ...result, status: settled } : result;

  if (!isLoading && isGuest) return <WalletGuest />;

  if (!balances) {
    // A failed read with nothing shown yet; a refetch that fails later keeps
    // the balances already on screen.
    if (wallet.isError) {
      return (
        <StateMessage
          icon={<TriangleAlert size={24} strokeWidth={1.5} />}
          title={t.t("wallet.loadFailedTitle")}
          body={t.t("wallet.loadFailedBody")}
          action={{
            label: t.t("common.retry"),
            onClick: () => void wallet.refetch(),
          }}
        />
      );
    }
    return (
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    );
  }

  const start = (next: WalletMode) => {
    setMode(next);
    setMethod(null);
    setAmount(500);
    setStep("method");
  };

  const goBack = () => {
    const index = WALLET_FLOW.indexOf(step);
    setStep(index > 0 ? WALLET_FLOW[index - 1] : "home");
  };

  const submit = () => {
    if (!method) return;
    createPayment.mutate(
      { mode, methodId: method.id, amount },
      {
        onSuccess: (payment) => {
          setResult(payment);
          setStep("pending");
        },
      },
    );
  };

  if (currentStep === "home") {
    return (
      <WalletHome
        balances={balances}
        onDeposit={() => start("deposit")}
        onWithdraw={() => start("withdraw")}
      />
    );
  }

  const title = t.t(mode === "withdraw" ? "wallet.withdraw" : "wallet.deposit");

  return (
    <>
      <FlowHeader
        title={title}
        step={currentStep}
        onBack={goBack}
        backLabel={t.t("auth.back")}
      />

      {currentStep === "method" && (
        <MethodStep
          mode={mode}
          kycVerified={kycVerified}
          canWithdraw={canWithdraw}
          selected={method}
          onSelect={setMethod}
          onContinue={() => setStep("amount")}
          onVerify={() => openAuth("verify")}
        />
      )}

      {currentStep === "amount" && method && (
        <AmountStep
          mode={mode}
          method={method}
          available={balances.cash}
          amount={amount}
          onAmountChange={setAmount}
          onContinue={() => setStep("confirm")}
        />
      )}

      {currentStep === "confirm" && method && (
        <ConfirmStep
          mode={mode}
          method={method}
          amount={amount}
          pending={createPayment.isPending}
          error={createPayment.error?.message ?? null}
          onConfirm={submit}
          onCancel={() => setStep("home")}
        />
      )}

      {currentResult &&
        method &&
        ["pending", "success", "failed"].includes(currentStep) && (
          <PaymentResultStep
            mode={mode}
            method={method}
            result={currentResult}
            onDone={() => {
              setResult(null);
              setStep("home");
            }}
            onBackToSports={() => router.push(routes.home)}
            onRetry={() => {
              setResult(null);
              setStep("confirm");
            }}
            onChooseAnother={() => {
              setResult(null);
              setStep("method");
            }}
            onCancel={() => {
              setResult(null);
              setStep("home");
            }}
          />
        )}
    </>
  );
}
