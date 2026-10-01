"use client";

import { CircleAlert } from "lucide-react";
import type { RuleSetJson } from "@golden/slipcalc";
import { useTranslation, type Translator } from "@/lib/i18n/use-translation";
import { normaliseMoney } from "@/lib/money";
import { cn } from "@/lib/utils/cn";
import { useBetSlipStore } from "../stores/bet-slip.store";
import type { BetSlipTotals, SlipProblem } from "../lib/calculate";

type Tone = "error" | "warn" | "info";

interface Alert {
  id: string;
  tone: Tone;
  title: string;
  body?: string;
  action?: { label: string; onClick: () => void };
}

/** A refusal from slipcalc, with the change that would make it go through. */
function problemAlert(
  problem: SlipProblem,
  t: Translator,
  fix: { setStake: (s: string) => void; useMultiple: () => void },
): Alert {
  switch (problem.code) {
    case "BET_STAKE_TOO_LOW":
    case "BET_STAKE_TOO_HIGH": {
      const low = problem.code === "BET_STAKE_TOO_LOW";
      const amount = t.money(problem.stake);
      return {
        id: problem.code,
        tone: "error",
        title: t.t(
          low
            ? "betSlip.errors.stakeTooLowTitle"
            : "betSlip.errors.stakeTooHighTitle",
        ),
        body: t.t(
          low
            ? "betSlip.errors.stakeTooLowBody"
            : "betSlip.errors.stakeTooHighBody",
          { amount },
        ),
        action: {
          label: t.t("betSlip.setMax", { amount: t.number(problem.stake) }),
          onClick: () => fix.setStake(problem.stake),
        },
      };
    }
    case "BET_TOO_MANY_LEGS":
      // Which picks to drop is the player's call, so there is no button.
      return {
        id: problem.code,
        tone: "error",
        title: t.t("betSlip.errors.tooManyLegsTitle"),
        body: t.t("betSlip.errors.tooManyLegsBody", { n: problem.limit }),
      };
    case "BET_TOO_MANY_LINES":
      return {
        id: problem.code,
        tone: "error",
        title: t.t("betSlip.errors.tooManyLinesTitle"),
        body: t.t("betSlip.errors.tooManyLinesBody", { n: problem.limit }),
        action: {
          label: t.t("betSlip.errors.useMultiple"),
          onClick: fix.useMultiple,
        },
      };
    case "VALIDATION_FAILED":
      return {
        id: problem.code,
        tone: "error",
        title: t.t("betSlip.errors.cannotPriceTitle"),
        body: t.t("betSlip.errors.cannotPriceBody"),
      };
  }
}

/**
 * Everything blocking or qualifying this slip, most severe first.
 *
 * Errors are red and stop the bet; an odds move is amber because it only needs
 * acknowledging; D1's warnings (a stake remainder not charged, a capped bonus or
 * payout) are information. Each alert carries the fix as a button where there
 * is one, so the user never has to work out what number would be accepted.
 */
export function SlipAlerts({
  totals,
  rules,
  rulesState,
  onRetryRules,
}: {
  totals: BetSlipTotals;
  rules: RuleSetJson | null;
  rulesState: "loading" | "ready" | "error";
  onRetryRules: () => void;
}) {
  const t = useTranslation();
  const stake = useBetSlipStore((s) => s.stake);
  const setStake = useBetSlipStore((s) => s.setStake);
  const setMode = useBetSlipStore((s) => s.setMode);
  const removeSelection = useBetSlipStore((s) => s.removeSelection);
  const acceptAllPending = useBetSlipStore((s) => s.acceptAllPending);

  const alerts: Alert[] = [];

  if (totals.count > 0 && rulesState === "error") {
    alerts.push({
      id: "rules",
      tone: "error",
      title: t.t("betSlip.rulesFailed"),
      action: { label: t.t("common.retry"), onClick: onRetryRules },
    });
  }

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
    const id = totals.suspendedSelection.outcomeId;
    alerts.push({
      id: "suspended",
      tone: "error",
      title: t.t("betSlip.alerts.suspendedTitle"),
      body: t.t("betSlip.alerts.suspendedBody"),
      action: {
        label: t.t("betSlip.alerts.removeIt"),
        onClick: () => removeSelection(id),
      },
    });
  }

  if (totals.problem) {
    alerts.push(
      problemAlert(totals.problem, t, {
        setStake,
        useMultiple: () => setMode("multiple"),
      }),
    );
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

  if (totals.insufficientBalance && totals.quote) {
    alerts.push({
      id: "balance",
      tone: "error",
      title: t.t("betSlip.alerts.insufficientTitle"),
      body: t.t("betSlip.alerts.insufficientBody", {
        amount: t.money(totals.quote.totalStake),
      }),
    });
  }

  const { quote } = totals;
  if (quote && rules) {
    for (const warning of quote.warnings) {
      switch (warning) {
        case "STAKE_REMAINDER_NOT_CHARGED":
          alerts.push({
            id: warning,
            tone: "info",
            title: t.t("betSlip.warnings.remainder", {
              amount: t.money(normaliseMoney(stake.replace(/\.$/, ""))),
              lines: quote.lines,
              charged: t.money(quote.totalStake),
            }),
          });
          break;
        case "ACCA_BONUS_CAPPED":
          alerts.push({
            id: warning,
            tone: "info",
            title: t.t("betSlip.warnings.bonusCapped", {
              amount: t.money(rules.acca_bonus_max),
            }),
          });
          break;
        case "MAX_PAYOUT_REACHED":
          alerts.push({
            id: warning,
            tone: "info",
            title: t.t("betSlip.warnings.maxPayout", {
              amount: t.money(rules.max_payout),
            }),
          });
          break;
      }
    }
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
            alert.tone === "error"
              ? "bg-loss-bg"
              : alert.tone === "warn"
                ? "bg-warn-bg"
                : "bg-surface",
          )}
        >
          <CircleAlert
            size={17}
            strokeWidth={1.5}
            aria-hidden
            className={cn(
              "shrink-0",
              alert.tone === "error"
                ? "text-loss"
                : alert.tone === "warn"
                  ? "text-warn"
                  : "text-muted",
            )}
          />
          <div className="min-w-0 flex-1">
            <div
              className={cn(alert.tone === "info" ? "text-xs" : "font-bold")}
            >
              {alert.title}
            </div>
            {alert.body && (
              <div className="text-muted text-xs">{alert.body}</div>
            )}
          </div>
          {alert.action && (
            <button
              type="button"
              onClick={alert.action.onClick}
              className="bg-raised text-text font-body min-h-11 shrink-0 cursor-pointer rounded-lg px-3 text-xs font-bold"
            >
              {alert.action.label}
            </button>
          )}
        </div>
      ))}
    </>
  );
}
