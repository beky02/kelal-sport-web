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
 * user has to choose which pick to drop.
 */
export function PlaceBetButton({
  action,
  disabled,
  totals,
  pending,
  onPlace,
  onDeposit,
  onLogin,
}: {
  action: CtaAction;
  disabled: boolean;
  totals: BetSlipTotals;
  pending: boolean;
  onPlace: () => void;
  onDeposit: () => void;
  onLogin: () => void;
}) {
  const t = useTranslation();
  const acceptAllPending = useBetSlipStore((s) => s.acceptAllPending);
  const removeSelection = useBetSlipStore((s) => s.removeSelection);

  const label: Record<CtaAction, string> = {
    place: t.t("betSlip.placeBet"),
    "accept-changes": t.t("betSlip.acceptChanges"),
    "remove-suspended": t.t("betSlip.removeSuspended"),
    deposit: t.t("betSlip.alerts.deposit"),
    "blocked-conflict": t.t("betSlip.removeSameMatch"),
    login: t.t("betSlip.loginToBet"),
  };

  const run = () => {
    switch (action) {
      case "place":
        return onPlace();
      case "accept-changes":
        return acceptAllPending();
      case "remove-suspended":
        return totals.suspendedSelection
          ? removeSelection(totals.suspendedSelection.uid)
          : undefined;
      case "deposit":
        return onDeposit();
      case "login":
        return onLogin();
      case "blocked-conflict":
        return undefined;
    }
  };

  const showAmount = action === "place" && !pending;

  return (
    <div className="px-4 pt-1 pb-4.5">
      <button
        type="button"
        onClick={run}
        disabled={disabled || pending}
        className={cn(
          "font-body flex h-[50px] w-full items-center rounded-md px-4 text-[15px] font-extrabold",
          showAmount ? "justify-between" : "justify-center gap-2",
          disabled || pending
            ? "bg-raised text-muted cursor-not-allowed"
            : "bg-accent text-on-accent cursor-pointer",
        )}
      >
        {pending && <Loader2 size={18} className="animate-spin" aria-hidden />}
        <span>{label[action]}</span>
        {showAmount && (
          <span className="numeric">{t.money(totals.totalStake)}</span>
        )}
      </button>
    </div>
  );
}
