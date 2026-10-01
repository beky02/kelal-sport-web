"use client";

import { CircleAlert, Info, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { PAYOUT_ACCOUNT } from "@/lib/api/mock/wallet";
import type { PaymentMethod, WalletMode } from "../types";

/**
 * The last screen before money moves.
 *
 * Restates everything the user chose and says what will happen next — a mobile
 * money deposit needs them to approve a prompt on their handset, and being told
 * that after nothing appears to happen is a support call.
 */
export function ConfirmStep({
  mode,
  method,
  amount,
  pending,
  error,
  onConfirm,
  onCancel,
}: {
  mode: WalletMode;
  method: PaymentMethod;
  amount: number;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslation();
  const withdrawing = mode === "withdraw";

  const rows = [
    { label: t.t("wallet.method"), value: method.name },
    { label: t.t("wallet.account"), value: PAYOUT_ACCOUNT },
    { label: t.t("wallet.amount"), value: t.money(amount) },
    { label: t.t("wallet.fee"), value: t.money(0) },
  ];

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
        <div className="flex items-baseline justify-between py-3">
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
        <span className="text-pretty">
          {t.t(withdrawing ? "wallet.promptWithdraw" : "wallet.promptDeposit", {
            method: method.name,
          })}
        </span>
      </div>

      {error && (
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
            <div className="text-muted text-xs">{error}</div>
          </div>
        </div>
      )}

      <button
        type="button"
        disabled={pending}
        onClick={onConfirm}
        className="bg-accent text-on-accent font-body flex h-[52px] cursor-pointer items-center justify-center gap-2 rounded-md text-[15px] font-bold disabled:opacity-60"
      >
        {pending && <Loader2 size={18} className="animate-spin" aria-hidden />}
        {t.t(withdrawing ? "wallet.confirmWithdraw" : "wallet.confirmDeposit")}
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
