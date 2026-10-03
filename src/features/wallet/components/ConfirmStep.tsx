"use client";

import type { ReactNode } from "react";
import { Info, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils/cn";
import type { PaymentMethod, WalletMode } from "../types";

/**
 * The last screen before money moves.
 *
 * Restates what the player chose and says what happens next — approve a
 * prompt on the phone, continue to the provider's page, or have the request
 * checked before it is paid — because being told that after nothing appears
 * to happen is a support call. Only what the player asked for is shown: the
 * amount, and for a withdrawal the account it goes to. No fee, total charged
 * or amount received, since the API sends none of them — and a withdrawal
 * may carry withholding tax (WDR-09) — and no time it takes to arrive.
 *
 * What went wrong last time, and its fix, is the caller's (`children`). The
 * buttons stay in the tab order while they can't act, so a keyboard keeps
 * its place when an answer arrives.
 */
export function ConfirmStep({
  mode,
  method,
  amount,
  accountLabel,
  sending,
  disabled = false,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  children,
}: {
  mode: WalletMode;
  method: PaymentMethod;
  /** The amount in the contract's form. */
  amount: string;
  /**
   * Where a withdrawal goes: a saved account masked as the API shows it, a
   * new number in full, so a typo is caught before money goes to it.
   */
  accountLabel?: string;
  /** On its way: nothing here can act until it is answered. */
  sending: boolean;
  /** Nothing may be sent: the method can't take it now, or the API said no. */
  disabled?: boolean;
  /** What the main button says: Confirm and pay, or Try again with the amount. */
  confirmLabel: string;
  /** Where the other button goes: Cancel, or Back to wallet once nothing can be. */
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  const t = useTranslation();
  const withdrawing = mode === "withdraw";
  const confirmOff = sending || disabled;

  const account = accountLabel ?? t.t("withdraw.yourAccount");
  const rows = withdrawing
    ? [
        { label: t.t("wallet.method"), value: method.name },
        { label: t.t("wallet.account"), value: account },
        { label: t.t("wallet.amount"), value: t.money(amount) },
      ]
    : [
        { label: t.t("wallet.method"), value: method.name },
        { label: t.t("wallet.amount"), value: t.money(amount) },
      ];

  const prompt = withdrawing
    ? t.t("withdraw.prompt", { account })
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
            {t.t(withdrawing ? "withdraw.youWithdraw" : "deposit.youDeposit")}
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
        aria-disabled={confirmOff || undefined}
        aria-busy={sending || undefined}
        onClick={confirmOff ? undefined : onConfirm}
        className={cn(
          "bg-accent text-on-accent font-body flex h-[52px] items-center justify-center gap-2 rounded-md px-3 text-[15px] font-bold",
          sending
            ? "cursor-wait opacity-60"
            : disabled
              ? "cursor-not-allowed opacity-60"
              : "cursor-pointer",
        )}
      >
        {sending && <Loader2 size={18} className="animate-spin" aria-hidden />}
        {confirmLabel}
      </button>

      <button
        type="button"
        aria-disabled={sending || undefined}
        onClick={sending ? undefined : onCancel}
        className={cn(
          "bg-raised text-text font-body h-12 rounded-md text-sm font-bold",
          sending ? "cursor-wait opacity-60" : "cursor-pointer",
        )}
      >
        {cancelLabel ?? t.t("wallet.cancel")}
      </button>
    </div>
  );
}
