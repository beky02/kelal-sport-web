"use client";

import { Check, Lock } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { SubmitButton } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils/cn";
import { usePaymentMethods } from "../hooks/use-wallet";
import type { PaymentMethod, WalletMode } from "../types";

/**
 * Picking how the money moves.
 *
 * Tiles rather than a list: the brand mark is how people recognise these, and the
 * per-transaction limits belong on the tile so nobody picks a method and then
 * discovers it cannot take the amount they had in mind.
 */
export function MethodStep({
  mode,
  kycVerified,
  selected,
  onSelect,
  onContinue,
  onVerify,
}: {
  mode: WalletMode;
  kycVerified: boolean;
  selected: PaymentMethod | null;
  onSelect: (method: PaymentMethod) => void;
  onContinue: () => void;
  onVerify: () => void;
}) {
  const t = useTranslation();
  const { data: methods, isPending } = usePaymentMethods(mode);

  // Withdrawals are the point at which Ethiopian law needs the ID checked.
  const locked = mode === "withdraw" && !kycVerified;

  return (
    <div className="flex flex-col gap-3.5 px-4 pt-4.5 pb-6">
      <h3 className="text-xl">
        {t.t(
          mode === "withdraw"
            ? "wallet.chooseWithdraw"
            : "wallet.chooseDeposit",
        )}
      </h3>

      {locked && (
        <div className="border-accent flex items-center gap-2.5 rounded-md border px-3 py-2.5">
          <Lock
            size={18}
            strokeWidth={1.5}
            aria-hidden
            className="text-accent shrink-0"
          />
          <span className="flex-1 text-xs">{t.t("wallet.kycLock")}</span>
          <button
            type="button"
            onClick={onVerify}
            className="text-accent cursor-pointer bg-transparent text-xs font-semibold"
          >
            {t.t("wallet.verifyNow")}
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-3">
        {isPending
          ? Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))
          : methods?.map((method) => {
              const on = method.id === selected?.id;
              return (
                <button
                  key={method.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onSelect(method)}
                  className={cn(
                    "font-body flex min-h-32 cursor-pointer flex-col items-start gap-1 rounded-lg border p-3 text-left",
                    on
                      ? "border-accent bg-raised shadow-[inset_0_0_0_1px_var(--color-accent)]"
                      : "bg-surface border-transparent",
                  )}
                >
                  <span className="flex w-full items-start justify-between">
                    <span className="bg-surface text-text font-display grid size-10 place-items-center rounded-md text-[13px] tracking-[0.02em]">
                      {method.mono}
                    </span>
                    {on && (
                      <span className="bg-accent text-on-accent grid size-5 place-items-center">
                        <Check size={12} strokeWidth={2.5} aria-hidden />
                      </span>
                    )}
                  </span>
                  <span className="text-text text-sm font-bold">
                    {method.name}
                  </span>
                  <span className="text-muted text-[11px]">
                    {t.t(
                      method.kind === "mobile"
                        ? "wallet.mobileMoney"
                        : "wallet.gateway",
                    )}
                  </span>
                  <span className="text-muted numeric text-[11px]">
                    {t.number(method.minAmount).replace(".00", "")} –{" "}
                    {t.number(method.maxAmount).replace(".00", "")}
                  </span>
                </button>
              );
            })}
      </div>

      <SubmitButton
        className="mt-1"
        disabled={selected === null || locked}
        onClick={onContinue}
      >
        {t.t("wallet.continue")}
      </SubmitButton>
    </div>
  );
}
