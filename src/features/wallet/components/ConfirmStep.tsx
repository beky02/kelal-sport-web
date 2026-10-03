"use client";

import type { ReactNode } from "react";
import { Info, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { PAYOUT_ACCOUNT } from "@/lib/api/mock/wallet";
import { cn } from "@/lib/utils/cn";
import type { PaymentMethod, WalletMode } from "../types";

/**
 * The last screen before money moves.
 *
 * Restates what the player chose and says what happens next — approve a
 * prompt on the phone, or continue to the provider's page — because being
 * told that after nothing appears to happen is a support call. A deposit
 * shows only what the API will charge: the amount. No fee or account is
 * shown for it, since the API sends neither.
 *
 * What went wrong last time, and its fix, is the caller's (`children`).
 */
export function ConfirmStep({
  mode,
  method,
  amount,
  sending,
  disabled = false,
  confirmLabel,
  onConfirm,
  onCancel,
  children,
}: {
  mode: WalletMode;
  method: PaymentMethod;
  /** The amount in the contract's form. */
  amount: string;
  sending: boolean;
  /** Nothing may be sent: the method can't take it now. */
  disabled?: boolean;
  /** What the main button says: Confirm and pay, or Try again with the amount. */
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  const t = useTranslation();
  const withdrawing = mode === "withdraw";

  const rows = withdrawing
    ? [
        { label: t.t("wallet.method"), value: method.name },
        { label: t.t("wallet.account"), value: PAYOUT_ACCOUNT },
        { label: t.t("wallet.amount"), value: t.money(amount) },
        { label: t.t("wallet.fee"), value: t.money("0.00") },
      ]
    : [
        { label: t.t("wallet.method"), value: method.name },
        { label: t.t("wallet.amount"), value: t.money(amount) },
      ];

  const prompt = withdrawing
    ? t.t("wallet.promptWithdraw", { method: method.name })
    : method.flow === "ussd_push"
      ? t.t("wallet.promptDeposit", { method: method.name })
      : t.t("deposit.promptWeb", { method: method.name });

  return (
    <div className="flex flex-col gap-3.5 px-4 pt-4.5 pb-6">
      <h3 className="text-xl">{t.t("wallet.confirmTitle")}</h3>

      <div className="bg-surface numeric flex flex-col rounded-lg px-3.5 py-1">
        {rows.map((row) => (
          <div
            key={row.label}
            className="border-divider flex justify-between gap-3 border-b py-2.5"
          >
            <span className="text-muted">{row.label}</span>
            <span className="text-right font-semibold">{row.value}</span>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 py-3">
          <span className="font-display text-[15px]">
            {t.t(withdrawing ? "wallet.youReceive" : "wallet.youPay")}
          </span>
          <span className="font-display text-xl">{t.money(amount)}</span>
        </div>
      </div>

      <div className="text-muted flex gap-2 text-xs">
        <Info
          size={16}
          strokeWidth={1.5}
          aria-hidden
          className="mt-0.5 shrink-0"
        />
        <span className="text-pretty">{prompt}</span>
      </div>

      {children}

      <button
        type="button"
        disabled={sending || disabled}
        aria-busy={sending || undefined}
        onClick={onConfirm}
        className={cn(
          "bg-accent text-on-accent font-body flex h-[52px] items-center justify-center gap-2 rounded-md px-3 text-[15px] font-bold disabled:opacity-60",
          sending
            ? "cursor-wait"
            : disabled
              ? "cursor-not-allowed"
              : "cursor-pointer",
        )}
      >
        {sending && <Loader2 size={18} className="animate-spin" aria-hidden />}
        {confirmLabel}
      </button>

      <button
        type="button"
        onClick={onCancel}
        className="bg-raised text-text font-body h-12 cursor-pointer rounded-md text-sm font-bold"
      >
        {t.t("wallet.cancel")}
      </button>
    </div>
  );
}
