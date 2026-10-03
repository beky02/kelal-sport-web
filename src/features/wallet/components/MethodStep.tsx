"use client";

import { Check, CircleAlert, Globe, Lock, Smartphone } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { SubmitButton } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils/cn";
import { usePaymentMethods } from "../hooks/use-payments";
import type {
  PaymentFlow,
  PaymentMethod,
  PaymentMethodCode,
  WalletMode,
} from "../types";

/** How the player pays with a method, in a line under its name — no per-provider words. */
const FLOW_LINE: Partial<
  Record<PaymentFlow, "deposit.flowPhone" | "deposit.flowWeb">
> = {
  ussd_push: "deposit.flowPhone",
  redirect: "deposit.flowWeb",
  app_or_web: "deposit.flowWeb",
};

/**
 * Picking how the money moves, from the methods `/v1/payment-methods` offers
 * this player.
 *
 * Tiles rather than a list, with the limits on the tile, so nobody picks a
 * method and then discovers it cannot take the amount they had in mind. A
 * method the API marks unavailable (its provider is down) can't be chosen,
 * and says so. A withdrawal lists only the methods that pay out.
 */
export function MethodStep({
  mode,
  kycVerified,
  canWithdraw,
  selected,
  onSelect,
  onContinue,
  onVerify,
}: {
  mode: WalletMode;
  kycVerified: boolean;
  /** The API's own verdict (`can_withdraw`); the server decides again on submit. */
  canWithdraw: boolean;
  selected: PaymentMethodCode | null;
  onSelect: (method: PaymentMethodCode) => void;
  onContinue: () => void;
  onVerify: () => void;
}) {
  const t = useTranslation();
  // The wallet is only shown to a signed-in player.
  const methods = usePaymentMethods(true);
  const withdrawing = mode === "withdraw";

  // Withdrawals are the point at which Ethiopian law needs the ID checked —
  // and the API may say no for other reasons, which are not fixed by the ID.
  const locked = withdrawing && !canWithdraw;

  const offered = (methods.data ?? []).filter(
    (method) => !withdrawing || method.withdrawal !== null,
  );
  const chosen = offered.find((method) => method.code === selected);
  const ready = chosen !== undefined && chosen.available;

  return (
    <div className="flex flex-col gap-3.5 px-4 pt-4.5 pb-6">
      <h3 className="text-xl">
        {t.t(withdrawing ? "wallet.chooseWithdraw" : "wallet.chooseDeposit")}
      </h3>

      {locked && (
        <div className="border-accent flex items-center gap-2.5 rounded-md border px-3 py-2.5">
          <Lock
            size={18}
            strokeWidth={1.5}
            aria-hidden
            className="text-accent shrink-0"
          />
          <span className="flex-1 text-xs">
            {t.t(kycVerified ? "wallet.withdrawUnavailable" : "wallet.kycLock")}
          </span>
          {!kycVerified && (
            <button
              type="button"
              onClick={onVerify}
              className="text-accent min-h-11 cursor-pointer bg-transparent px-1 text-xs font-semibold"
            >
              {t.t("wallet.verifyNow")}
            </button>
          )}
        </div>
      )}

      {methods.isPending ? (
        <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : !methods.data ? (
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
          <span className="min-w-0 flex-1 text-xs font-semibold">
            {t.t("deposit.methodsFailed")}
          </span>
          <button
            type="button"
            onClick={() => void methods.refetch()}
            className="bg-raised text-text font-body min-h-11 shrink-0 cursor-pointer rounded-lg px-3 text-xs font-bold"
          >
            {t.t("common.retry")}
          </button>
        </div>
      ) : offered.length === 0 ? (
        <p className="text-muted py-6 text-center text-xs text-pretty">
          {t.t("deposit.methodsEmpty")}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-3">
          {offered.map((method) => (
            <MethodTile
              key={method.code}
              method={method}
              mode={mode}
              on={method.code === selected && method.available}
              onSelect={() => onSelect(method.code)}
            />
          ))}
        </div>
      )}

      <SubmitButton
        className="mt-1"
        disabled={!ready || locked}
        onClick={onContinue}
      >
        {t.t("wallet.continue")}
      </SubmitButton>
    </div>
  );
}

function MethodTile({
  method,
  mode,
  on,
  onSelect,
}: {
  method: PaymentMethod;
  mode: WalletMode;
  on: boolean;
  onSelect: () => void;
}) {
  const t = useTranslation();
  const range = mode === "withdraw" ? method.withdrawal : method.deposit;
  const flowLine = FLOW_LINE[method.flow];
  const Icon = method.flow === "ussd_push" ? Smartphone : Globe;

  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={!method.available}
      onClick={onSelect}
      className={cn(
        "font-body flex min-h-32 flex-col items-start gap-1 rounded-lg border p-3 text-left",
        !method.available
          ? "bg-surface border-divider cursor-not-allowed opacity-60"
          : on
            ? "border-accent bg-raised cursor-pointer shadow-[inset_0_0_0_1px_var(--color-accent)]"
            : "bg-surface cursor-pointer border-transparent",
      )}
    >
      <span className="flex w-full items-start justify-between">
        <span className="bg-raised text-text grid size-10 place-items-center rounded-md">
          <Icon size={20} strokeWidth={1.5} aria-hidden />
        </span>
        {on && (
          <span className="bg-accent text-on-accent grid size-5 place-items-center">
            <Check size={12} strokeWidth={2.5} aria-hidden />
          </span>
        )}
      </span>
      <span className="text-text text-sm font-bold">{method.name}</span>
      {mode === "deposit" && flowLine && (
        <span className="text-muted text-xs">{t.t(flowLine)}</span>
      )}
      {range && (
        <span className="text-muted numeric text-xs">
          {t.money(range.min)} – {t.money(range.max)}
        </span>
      )}
      {!method.available && (
        <span className="text-loss text-xs font-semibold">
          {t.t("deposit.unavailable")}
        </span>
      )}
    </button>
  );
}
