"use client";

import { TriangleAlert } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { SubmitButton } from "@/components/ui/Field";
import { cn } from "@/lib/utils/cn";
import { PAYOUT_ACCOUNT } from "@/lib/api/mock/wallet";
import { compareMoney } from "@/lib/money";
import type { PaymentMethod, WalletMode } from "../types";

const CHIPS = [50, 100, 500, 1000];

/**
 * How much.
 *
 * On the way out the cash balance binds, and is shown, because a user who is
 * refused wants to know which rule stopped them, not that "a limit" exists.
 * Validated again on the server; this is only here to save a round trip. (The
 * method's limits and the amount become the contract's strings in F6b; a
 * deposit limit is the API's to refuse until F7 shows it here.)
 */
export function AmountStep({
  mode,
  method,
  available,
  amount,
  onAmountChange,
  onContinue,
}: {
  mode: WalletMode;
  method: PaymentMethod;
  /** The cash balance as the API sent it: what a withdrawal can take. */
  available: string;
  /** Whole birr: the field takes digits only. */
  amount: number;
  onAmountChange: (amount: number) => void;
  onContinue: () => void;
}) {
  const t = useTranslation();
  const withdrawing = mode === "withdraw";

  // Compared as strings (FD4): the typed amount is whole birr, so `String`
  // is its exact decimal form — while it is a safe integer. Anything longer
  // is no amount at all (`String` gives "1e+22") and far above any balance:
  // the contract's `Money` has at most 12 digits before the point.
  const overCeiling =
    withdrawing &&
    (!Number.isSafeInteger(amount) ||
      compareMoney(String(amount), available) > 0);
  const belowMinimum = amount > 0 && amount < method.minAmount;
  const blocked = overCeiling || belowMinimum || amount <= 0;

  return (
    <div className="flex flex-col gap-3.5 px-4 pt-4.5 pb-6">
      <div className="flex items-center gap-2.5">
        <span className="bg-surface font-display grid size-9 place-items-center rounded-md text-xs">
          {method.mono}
        </span>
        <div>
          <div className="font-bold">{method.name}</div>
          <div className="text-muted text-[11px]">
            {t.t(withdrawing ? "wallet.toAccount" : "wallet.fromAccount", {
              account: PAYOUT_ACCOUNT,
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-col">
        <label
          htmlFor="wallet-amount"
          className="text-text/70 mb-[5px] text-xs"
        >
          {t.t("wallet.amount")}
        </label>
        <div
          className={cn(
            "bg-surface flex h-16 rounded-md border",
            overCeiling || belowMinimum ? "border-loss" : "border-divider",
          )}
        >
          <span className="border-divider text-muted flex items-center border-r px-3.5 font-semibold">
            {t.t("header.currency")}
          </span>
          <input
            id="wallet-amount"
            inputMode="numeric"
            aria-label={t.t("wallet.amount")}
            aria-invalid={overCeiling || belowMinimum ? true : undefined}
            value={amount === 0 ? "" : String(amount)}
            onChange={(event) =>
              onAmountChange(Number(event.target.value.replace(/\D/g, "") || 0))
            }
            className="font-display numeric text-text min-w-0 flex-1 border-0 bg-transparent px-3.5 text-[26px] outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {CHIPS.map((chip) => {
          const on = amount === chip;
          return (
            <button
              key={chip}
              type="button"
              onClick={() => onAmountChange(chip)}
              className={cn(
                "font-body h-11 cursor-pointer rounded-md text-sm font-semibold",
                on ? "bg-accent text-on-accent" : "bg-raised text-text",
              )}
            >
              {t.number(chip).replace(".00", "")}
            </button>
          );
        })}
      </div>

      {(overCeiling || belowMinimum) && (
        <div role="alert" className="text-loss flex items-center gap-2 text-xs">
          <TriangleAlert
            size={16}
            strokeWidth={1.5}
            aria-hidden
            className="shrink-0"
          />
          {overCeiling
            ? t.t("wallet.overWithdrawable")
            : t.t("wallet.belowMinimum", {
                method: method.name,
                amount: t.money(method.minAmount),
              })}
        </div>
      )}

      <div className="bg-surface numeric flex flex-col gap-1.5 rounded-md p-3 text-xs">
        {withdrawing && (
          <div className="flex justify-between">
            <span className="text-muted">
              {t.t("wallet.availableToWithdraw")}
            </span>
            <span className="font-semibold">{t.money(available)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted">{t.t("wallet.minMax")}</span>
          <span>
            {t.money(method.minAmount)} – {t.money(method.maxAmount)}
          </span>
        </div>
      </div>

      <SubmitButton disabled={blocked} onClick={onContinue}>
        {t.t("wallet.continue")}
      </SubmitButton>
    </div>
  );
}
