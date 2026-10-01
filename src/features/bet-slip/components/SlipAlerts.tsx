"use client";

import { CircleAlert } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils/cn";
import { useBetSlipStore } from "../stores/bet-slip.store";
import type { BetSlipTotals } from "../lib/calculate";

type Tone = "error" | "warn";

interface Alert {
  id: string;
  tone: Tone;
  title: string;
  body: string;
  action?: { label: string; onClick: () => void };
}

/**
 * Everything blocking this slip, most severe first.
 *
 * Errors are red and stop the bet; an odds move is amber because it only needs
 * acknowledging. Each alert carries the fix as a button, so the user never has
 * to work out which of five picks is the problem.
 */
export function SlipAlerts({ totals }: { totals: BetSlipTotals }) {
  const t = useTranslation();
  const setMode = useBetSlipStore((s) => s.setMode);
  const removeSelection = useBetSlipStore((s) => s.removeSelection);
  const acceptAllPending = useBetSlipStore((s) => s.acceptAllPending);

  const alerts: Alert[] = [];

  if (totals.hasConflict) {
    alerts.push({
      id: "conflict",
      tone: "error",
      title: t.t("betSlip.alerts.conflictTitle"),
      body: t.t("betSlip.alerts.conflictBody"),
      action: {
        label: t.t("betSlip.alerts.useSingle"),
        onClick: () => setMode("single"),
      },
    });
  }

  if (totals.suspendedSelection) {
    const uid = totals.suspendedSelection.uid;
    alerts.push({
      id: "suspended",
      tone: "error",
      title: t.t("betSlip.alerts.suspendedTitle"),
      body: t.t("betSlip.alerts.suspendedBody"),
      action: {
        label: t.t("betSlip.alerts.removeIt"),
        onClick: () => removeSelection(uid),
      },
    });
  }

  if (totals.pendingOddsChanges.length > 0) {
    alerts.push({
      id: "odds",
      tone: "warn",
      title: t.t("betSlip.alerts.oddsChangedTitle"),
      body: t.t("betSlip.alerts.oddsChangedBody", {
        n: totals.pendingOddsChanges.length,
      }),
      action: {
        label: t.t("betSlip.acceptAll"),
        onClick: acceptAllPending,
      },
    });
  }

  if (totals.insufficientBalance) {
    alerts.push({
      id: "balance",
      tone: "error",
      title: t.t("betSlip.alerts.insufficientTitle"),
      body: t.t("betSlip.alerts.insufficientBody", {
        amount: t.money(totals.totalStake),
      }),
    });
  }

  if (alerts.length === 0) return null;

  return (
    <>
      {alerts.map((alert) => (
        <div
          key={alert.id}
          role={alert.tone === "error" ? "alert" : "status"}
          className={cn(
            "mx-3 mb-2.5 flex items-center gap-2.5 rounded-md py-2.5 pr-2 pl-3",
            alert.tone === "error" ? "bg-loss-bg" : "bg-warn-bg",
          )}
        >
          <CircleAlert
            size={17}
            strokeWidth={1.5}
            aria-hidden
            className={cn(
              "shrink-0",
              alert.tone === "error" ? "text-loss" : "text-warn",
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="font-bold">{alert.title}</div>
            <div className="text-muted text-xs">{alert.body}</div>
          </div>
          {alert.action && (
            <button
              type="button"
              onClick={alert.action.onClick}
              className="bg-raised text-text font-body h-9 shrink-0 cursor-pointer rounded-lg px-3 text-xs font-bold"
            >
              {alert.action.label}
            </button>
          )}
        </div>
      ))}
    </>
  );
}
