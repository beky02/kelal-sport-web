"use client";

import { TriangleAlert } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { SubmitButton } from "@/components/ui/Field";
import { cn } from "@/lib/utils/cn";
import { PAYOUT_ACCOUNT } from "@/lib/api/mock/wallet";
import { compareMoney, sanitiseAmount } from "@/lib/money";
import { amountProblem, typedAmount } from "../lib/amount";
import type { PaymentMethod, WalletMode } from "../types";

/** Quick amounts, in whole birr, as the design has them. */
const CHIPS = ["50", "100", "500", "1000"];

/**
 * How much.
 *
 * The method's own limits for this direction — the API's strings — bind, and
 * are shown, because a player who is refused wants to know which rule stopped
 * them, not that "a limit" exists; on the way out the cash balance binds too.
 * Everything is compared as strings (FD4). The API checks again: this only
 * saves a round trip.
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
  available?: string;
  /** As typed: digits, one point, two decimals at most. */
  amount: string;
  onAmountChange: (amount: string) => void;
  onContinue: () => void;
}) {
  const t = useTranslation();
  const withdrawing = mode === "withdraw";
  // A withdrawal step is only reached for a method that pays out.
  const range = (withdrawing ? method.withdrawal : method.deposit) ?? {
    min: "0.00",
    max: "0.00",
  };

  const problem = amountProblem(amount, range);
  const typed = typedAmount(amount);
  const overCeiling =
    withdrawing &&
    available !== undefined &&
    typed !== null &&
    compareMoney(typed, available) > 0;
  const message = overCeiling
    ? t.t("wallet.overWithdrawable")
    : problem === "below"
      ? t.t("wallet.belowMinimum", {
          method: method.name,
          amount: t.money(range.min),
        })
      : problem === "above"
        ? t.t("wallet.aboveMaximum", {
            method: method.name,
            amount: t.money(range.max),
          })
        : null;

  return (
    <div className="flex flex-col gap-3.5 px-4 pt-4.5 pb-6">
      <div>
        <div className="font-bold">{method.name}</div>
        {withdrawing && (
          <div className="text-muted text-xs">
            {t.t("wallet.toAccount", { account: PAYOUT_ACCOUNT })}
          </div>
        )}
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
            message ? "border-loss" : "border-divider",
            // The unit where the language puts it: ETB 500.00, 500.00 ብር (06).
            t.lang === "am" && "flex-row-reverse",
          )}
        >
          <span
            className={cn(
              "border-divider text-muted flex items-center px-3.5 font-semibold",
              t.lang === "am" ? "border-l" : "border-r",
            )}
          >
            {t.t("header.currency")}
          </span>
          <input
            id="wallet-amount"
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? "wallet-amount-problem" : undefined}
            value={amount}
            onChange={(event) =>
              onAmountChange(sanitiseAmount(event.target.value))
            }
            className="font-display numeric text-text min-w-0 flex-1 border-0 bg-transparent px-3.5 text-[26px] outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {CHIPS.map((chip) => {
          // "500" and "500.00" are one amount (a retry brings the latter back).
          const on = typed !== null && typed === typedAmount(chip);
          return (
            <button
              key={chip}
              type="button"
              aria-pressed={on}
              onClick={() => onAmountChange(chip)}
              className={cn(
                "font-body numeric h-11 cursor-pointer rounded-md text-sm font-semibold",
                on ? "bg-accent text-on-accent" : "bg-raised text-text",
              )}
            >
              {t.number(chip).replace(/\.00$/, "")}
            </button>
          );
        })}
      </div>

      {message && (
        <div
          id="wallet-amount-problem"
          role="alert"
          className="text-loss flex items-center gap-2 text-xs"
        >
          <TriangleAlert
            size={16}
            strokeWidth={1.5}
            aria-hidden
            className="shrink-0"
          />
          {message}
        </div>
      )}

      <div className="bg-surface numeric flex flex-col gap-1.5 rounded-md p-3 text-xs">
        {withdrawing && available !== undefined && (
          <div className="flex justify-between gap-3">
            <span className="text-muted">
              {t.t("wallet.availableToWithdraw")}
            </span>
            <span className="font-semibold">{t.money(available)}</span>
          </div>
        )}
        <div className="flex flex-wrap justify-between gap-x-3">
          <span className="text-muted">{t.t("wallet.minMax")}</span>
          <span>
            {t.money(range.min)} – {t.money(range.max)}
          </span>
        </div>
      </div>

      <SubmitButton
        disabled={problem !== null || overCeiling}
        onClick={onContinue}
      >
        {t.t("wallet.continue")}
      </SubmitButton>
    </div>
  );
}
