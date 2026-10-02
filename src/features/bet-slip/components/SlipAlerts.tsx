"use client";

import { CircleAlert } from "lucide-react";
import type { RuleSetJson } from "@golden/slipcalc";
import { useSession } from "@/features/auth/hooks/use-session";
import { useDateTimeText } from "@/features/bookings/hooks/use-date-time-text";
import { useTranslation, type Translator } from "@/lib/i18n/use-translation";
import { normaliseMoney } from "@/lib/money";
import { cn } from "@/lib/utils/cn";
import { useBetSlipStore } from "../stores/bet-slip.store";
import type { BetSlipTotals, SlipProblem } from "../lib/calculate";
import type { PlaceRefusal } from "../types";

type Tone = "error" | "warn" | "info";

interface Alert {
  id: string;
  tone: Tone;
  title: string;
  body?: string;
  /** The API's own `detail`, as its own line. */
  detail?: string | null;
  action?: { label: string; onClick: () => void };
}

/** What a refusal of the bet can offer as its fix. */
export interface PlacementFixes {
  /** Send again the request that had no answer, with its own key. */
  retry: () => void;
  deposit: () => void;
  verify: () => void;
  viewLimits: () => void;
}

/**
 * The engine's refusal of the bet, by its Problem `code` — never by its
 * title, which is display text in whatever language the API chose — with
 * the fix where there is one. Null when another alert already says it: the
 * picks a 409 re-priced or closed carry their own (`pickChanged`,
 * `pickClosed`).
 */
function refusalAlert(
  refusal: PlaceRefusal,
  t: Translator,
  ctx: {
    fixes: PlacementFixes;
    setStake: (stake: string) => void;
    rules: RuleSetJson | null;
    pickChanged: boolean;
    pickClosed: boolean;
    breakUntil: string | null;
  },
): Alert | null {
  const notPlaced = t.t("betSlip.placeFailed");
  const base = {
    id: "refused",
    tone: "error" as const,
    detail: refusal.detail,
  };
  const limit = refusal.errors.find((e) => e.limit !== undefined)?.limit;

  switch (refusal.code) {
    case "BET_ODDS_CHANGED":
      return ctx.pickChanged
        ? null
        : {
            ...base,
            title: notPlaced,
            body: t.t("betSlip.refused.oddsUnknown"),
          };
    case "BET_EVENT_STARTED":
    case "BET_MARKET_SUSPENDED":
      return ctx.pickClosed
        ? null
        : {
            ...base,
            title: notPlaced,
            body: t.t("betSlip.refused.closedUnknown"),
          };
    case "BET_STAKE_TOO_LOW":
    case "BET_STAKE_TOO_HIGH": {
      const low = refusal.code === "BET_STAKE_TOO_LOW";
      const stake = refusal.errors.find((e) => e.field === "stake")?.limit;
      const title = t.t(
        low
          ? "betSlip.errors.stakeTooLowTitle"
          : "betSlip.errors.stakeTooHighTitle",
      );
      if (!stake)
        return { ...base, title, body: t.t("betSlip.placeFailedBody") };
      return {
        ...base,
        // The limit says it all; the API's own sentence would repeat it.
        detail: null,
        title,
        body: t.t(
          low
            ? "betSlip.errors.stakeTooLowBody"
            : "betSlip.errors.stakeTooHighBody",
          { amount: t.money(stake) },
        ),
        action: {
          label: t.t("betSlip.setMax", { amount: t.number(stake) }),
          onClick: () => ctx.setStake(stake),
        },
      };
    }
    case "BET_LIMIT_EXCEEDED":
      return {
        ...base,
        title: t.t("betSlip.refused.limitTitle"),
        body: limit
          ? t.t("betSlip.refused.limitWith", { amount: t.money(limit) })
          : t.t("betSlip.refused.limit"),
        action: limit
          ? {
              label: t.t("betSlip.setMax", { amount: t.number(limit) }),
              onClick: () => ctx.setStake(limit),
            }
          : undefined,
      };
    case "WALLET_INSUFFICIENT_FUNDS":
      return {
        ...base,
        title: t.t("betSlip.alerts.insufficientTitle"),
        body: t.t("betSlip.refused.insufficient"),
        action: {
          label: t.t("betSlip.alerts.deposit"),
          onClick: ctx.fixes.deposit,
        },
      };
    case "BET_RELATED_SELECTIONS":
      return {
        ...base,
        title: notPlaced,
        body: t.t("betSlip.alerts.conflictBody"),
      };
    case "BET_TOO_MANY_LEGS":
      return {
        ...base,
        title: notPlaced,
        body: t.t("betSlip.errors.tooManyLegsBody", {
          n: limit ?? ctx.rules?.max_legs ?? "",
        }),
      };
    case "BET_TOO_MANY_LINES":
      return {
        ...base,
        title: notPlaced,
        body: t.t("betSlip.errors.tooManyLinesBody", {
          n: limit ?? ctx.rules?.max_lines ?? "",
        }),
      };
    case "KYC_REQUIRED":
      return {
        ...base,
        title: t.t("betSlip.refused.kycTitle"),
        body: t.t("betSlip.refused.kyc"),
        action: { label: t.t("auth.verify"), onClick: ctx.fixes.verify },
      };
    case "RG_LIMIT_REACHED":
      return {
        ...base,
        title: t.t("betSlip.refused.rgLimitTitle"),
        body: t.t("betSlip.refused.rgLimit"),
        action: {
          label: t.t("system.viewLimits"),
          onClick: ctx.fixes.viewLimits,
        },
      };
    case "RG_SELF_EXCLUDED":
    case "RG_COOLING_OFF":
      // Nothing to offer: a break cannot be ended from here.
      return {
        ...base,
        title: t.t("betSlip.refused.breakTitle"),
        body: ctx.breakUntil
          ? t.t("betSlip.refused.breakUntil", { date: ctx.breakUntil })
          : t.t("betSlip.refused.break"),
      };
    case "REAL_MONEY_DISABLED":
      return {
        ...base,
        title: notPlaced,
        body: t.t("betSlip.refused.realMoney"),
      };
    case "RATE_LIMITED":
      return {
        ...base,
        title: notPlaced,
        body:
          refusal.retryAfter !== null
            ? t.t("betSlip.refused.rateLimitedSeconds", {
                seconds: refusal.retryAfter,
              })
            : t.t("betSlip.refused.rateLimited"),
      };
    default:
      // A code this app has no copy of: the API's own, translated title.
      return {
        ...base,
        title: notPlaced,
        body: refusal.title || t.t("betSlip.placeFailedBody"),
      };
  }
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
 * The engine's answer to the last Place — no answer, or a refusal — comes
 * first, and stays until the slip changes or Place is tapped again.
 */
export function SlipAlerts({
  totals,
  rules,
  rulesState,
  onRetryRules,
  fixes,
}: {
  totals: BetSlipTotals;
  rules: RuleSetJson | null;
  rulesState: "loading" | "ready" | "error";
  onRetryRules: () => void;
  fixes: PlacementFixes;
}) {
  const t = useTranslation();
  const dateTime = useDateTimeText();
  const excludedUntil = useSession().player?.flags.excludedUntil ?? null;
  const placement = useBetSlipStore((s) => s.placement);
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

  // No answer: the bet may have gone through, so the way on is the same
  // request with the same key — never a new bet.
  if (placement.attempt?.status === "unanswered") {
    alerts.push({
      id: "unconfirmed",
      tone: "error",
      title: t.t("betSlip.unconfirmed.title"),
      body: t.t("betSlip.unconfirmed.body"),
      action: { label: t.t("common.retry"), onClick: fixes.retry },
    });
  }

  const refusal = placement.refusal;
  const refused = refusal
    ? refusalAlert(refusal, t, {
        fixes,
        setStake,
        rules,
        pickChanged: totals.pendingOddsChanges.length > 0,
        pickClosed: totals.suspendedSelection !== null,
        breakUntil: excludedUntil ? dateTime(excludedUntil) : null,
      })
    : null;
  if (refused) alerts.push(refused);

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
    // After the engine refused the bet for it, say so — and which it was.
    const started = refusal?.code === "BET_EVENT_STARTED";
    const paused = refusal?.code === "BET_MARKET_SUSPENDED";
    alerts.push({
      id: "suspended",
      tone: "error",
      title: t.t(
        started
          ? "betSlip.refused.startedTitle"
          : "betSlip.alerts.suspendedTitle",
      ),
      body: t.t(
        started
          ? "betSlip.refused.started"
          : paused
            ? "betSlip.refused.suspended"
            : "betSlip.alerts.suspendedBody",
      ),
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
      body: t.t(
        refusal?.code === "BET_ODDS_CHANGED"
          ? "betSlip.refused.oddsChanged"
          : "betSlip.alerts.oddsChangedBody",
        { n: totals.pendingOddsChanges.length },
      ),
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
            {alert.detail && (
              <div className="text-muted text-xs">{alert.detail}</div>
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
