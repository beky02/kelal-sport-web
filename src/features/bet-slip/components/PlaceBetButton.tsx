"use client";

import { Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils/cn";
import { useBetSlipStore } from "../stores/bet-slip.store";
import type { BetSlipTotals, CtaAction } from "../lib/calculate";

/**
 * The primary action, whatever it currently is.
 *
 * One button with one job at a time: if the slip cannot be placed, it does the
 * next thing that would make it placeable instead of sitting greyed out with no
 * explanation. Only an unresolvable conflict actually disables it, because the
 * user has to choose which pick to drop. While a bet is unconfirmed its job is
 * Try again — the same bet with the same key — as long as the slip above it
 * still is that bet; once it is another, it places that as a new bet. Every
 * job that charges shows the amount it charges (`amount`).
 *
 * While a bet is on its way it stays focusable and says so (`aria-busy`,
 * "Placing…"): disabling the button the player just pressed would drop their
 * focus out of the sheet.
 */
export function PlaceBetButton({
  action,
  disabled,
  amount,
  totals,
  pending,
  onPlace,
  onPlaceNew,
  onRetry,
  onDeposit,
  onLogin,
}: {
  action: CtaAction;
  disabled: boolean;
  /** What the action charges — slipcalc's total stake — or null for none. */
  amount: string | null;
  totals: BetSlipTotals;
  pending: boolean;
  onPlace: () => void;
  onPlaceNew: () => void;
  onRetry: () => void;
  onDeposit: () => void;
  onLogin: () => void;
}) {
  const t = useTranslation();
  const acceptAllPending = useBetSlipStore((s) => s.acceptAllPending);
  const removeSelection = useBetSlipStore((s) => s.removeSelection);

  const label: Record<CtaAction, string> = {
    place: t.t("betSlip.placeBet"),
    retry: t.t("common.retry"),
    "place-new": t.t("betSlip.unconfirmed.placeNew"),
    "accept-changes": t.t("betSlip.acceptChanges"),
    "remove-suspended": t.t("betSlip.removeSuspended"),
    deposit: t.t("betSlip.alerts.deposit"),
    "blocked-conflict": t.t("betSlip.removeSameMatch"),
    login: t.t("betSlip.loginToBet"),
  };

  const run = () => {
    if (pending) return;
    switch (action) {
      case "place":
        return onPlace();
      case "retry":
        return onRetry();
      case "place-new":
        return onPlaceNew();
      case "accept-changes":
        return acceptAllPending();
      case "remove-suspended":
        return totals.suspendedSelection
          ? removeSelection(totals.suspendedSelection.outcomeId)
          : undefined;
      case "deposit":
        return onDeposit();
      case "login":
        return onLogin();
      case "blocked-conflict":
        return undefined;
    }
  };

  const showAmount = amount !== null && !pending;

  return (
    <div className="px-4 pt-1 pb-4.5">
      <button
        type="button"
        onClick={run}
        disabled={disabled && !pending}
        aria-disabled={pending || undefined}
        aria-busy={pending || undefined}
        className={cn(
          "font-body flex h-[50px] w-full items-center rounded-md px-4 text-[15px] font-extrabold",
          showAmount ? "justify-between" : "justify-center gap-2",
          disabled || pending
            ? "bg-raised text-muted cursor-not-allowed"
            : "bg-accent text-on-accent cursor-pointer",
        )}
      >
        {pending && <Loader2 size={18} className="animate-spin" aria-hidden />}
        <span>{pending ? t.t("betSlip.placing") : label[action]}</span>
        {amount !== null && showAmount && (
          <span className="numeric">{t.money(amount)}</span>
        )}
      </button>
    </div>
  );
}
