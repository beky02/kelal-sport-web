"use client";

import { CircleAlert } from "lucide-react";
import type { RuleSetJson } from "@golden/slipcalc";
import { useSession } from "@/features/auth/hooks/use-session";
import { useDateTimeText } from "@/features/bookings/hooks/use-date-time-text";
import { useTranslation, type Translator } from "@/lib/i18n/use-translation";
import { normaliseMoney } from "@/lib/money";
import { cn } from "@/lib/utils/cn";
import { useBetSlipStore, type Placement } from "../stores/bet-slip.store";
import type { BetSlipTotals, SlipProblem } from "../lib/calculate";
import {
  refusalNotice,
  type RefusalNotice,
  type RefusalText,
} from "../lib/refusals";

type Tone = "error" | "warn" | "info";

interface Alert {
  id: string;
  tone: Tone;
  title: string;
  body?: string;
  /** A further line: the API's own `detail`, or what changed since. */
  detail?: string | null;
  /**
   * Announce it at once (`role="alert"`) whatever its tone — a refusal of the
   * bet, even when it only needs an Accept.
   */
  urgent?: boolean;
  action?: { label: string; onClick: () => void };
  /** A second choice, shown beside the first under the text. */
  secondary?: { label: string; onClick: () => void };
}

/** What the slip can do about the engine's answer. */
export interface PlacementFixes {
  /** Send the unconfirmed bet again: its own request and key. */
  retry: () => void;
  /** Place the slip as it is now as a new bet; null when there is nothing to choose. */
  placeAsNew: (() => void) | null;
  deposit: () => void;
  verify: () => void;
  viewLimits: () => void;
}

/** A refusal's text, filled in for the language on screen. */
function say(text: RefusalText, t: Translator): string {
  return t.t(text.key, {
    ...(text.amount !== undefined ? { amount: t.money(text.amount) } : {}),
    ...(text.n !== undefined ? { n: text.n } : {}),
    ...(text.seconds !== undefined ? { seconds: text.seconds } : {}),
    ...(text.date !== undefined ? { date: text.date } : {}),
  });
}

/** The engine's refusal (`refusalNotice`) as an alert, its fix as a button. */
function refusalAlert(
  notice: RefusalNotice,
  t: Translator,
  fixes: PlacementFixes & { setStake: (stake: string) => void },
): Alert {
  const { fix } = notice;
  return {
    id: "refused",
    tone: "error",
    title: say(notice.title, t),
    body: "text" in notice.body ? notice.body.text : say(notice.body, t),
    detail: notice.detail,
    action: !fix
      ? undefined
      : fix.kind === "stake"
        ? {
            label: t.t("betSlip.setMax", { amount: t.number(fix.amount) }),
            onClick: () => fixes.setStake(fix.amount),
          }
        : fix.kind === "deposit"
          ? { label: t.t("betSlip.alerts.deposit"), onClick: fixes.deposit }
          : fix.kind === "verify"
            ? { label: t.t("auth.verify"), onClick: fixes.verify }
            : {
                label: t.t("system.viewLimits"),
                onClick: fixes.viewLimits,
              },
  };
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
  placement,
  slipChanged,
  fixes,
}: {
  totals: BetSlipTotals;
  rules: RuleSetJson | null;
  rulesState: "loading" | "ready" | "error";
  onRetryRules: () => void;
  /** The signed-in player's own placement (`ownPlacement`). */
  placement: Placement;
  /** A bet is unconfirmed and the slip is no longer that bet. */
  slipChanged: boolean;
  fixes: PlacementFixes;
}) {
  const t = useTranslation();
  const dateTime = useDateTimeText();
  const excludedUntil = useSession().player?.flags.excludedUntil ?? null;
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

  // No answer: the bet may have gone through. The way on is the same bet with
  // the same key; a different bet only by the player's explicit choice.
  const { unconfirmed } = placement;
  if (unconfirmed) {
    alerts.push({
      id: "unconfirmed",
      tone: "error",
      title: t.t("betSlip.unconfirmed.title"),
      body: t.t("betSlip.unconfirmed.body"),
      detail: slipChanged ? t.t("betSlip.unconfirmed.changed") : null,
      action: { label: t.t("common.retry"), onClick: fixes.retry },
      secondary: fixes.placeAsNew
        ? {
            label: t.t("betSlip.unconfirmed.placeNew"),
            onClick: fixes.placeAsNew,
          }
        : undefined,
    });
  }

  // A refusal of the bet. While an earlier bet is unconfirmed this was a
  // retry, and nothing may say "your bet wasn't placed".
  const refusal = placement.refusal;
  const firstTry = refusal !== null && unconfirmed === null;
  const notice = refusal
    ? refusalNotice(refusal, {
        lines: totals.lineCount,
        rules,
        pickChanged: totals.pendingOddsChanges.length > 0,
        pickClosed: totals.suspendedSelection !== null,
        unconfirmed: unconfirmed !== null,
        breakUntil: excludedUntil ? dateTime(excludedUntil) : null,
      })
    : null;
  if (notice) alerts.push(refusalAlert(notice, t, { ...fixes, setStake }));

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
    const started = firstTry && refusal?.code === "BET_EVENT_STARTED";
    const paused = firstTry && refusal?.code === "BET_MARKET_SUSPENDED";
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
    // The engine's refusal says the bet wasn't placed: announced at once.
    const refused = firstTry && refusal?.code === "BET_ODDS_CHANGED";
    alerts.push({
      id: "odds",
      tone: "warn",
      urgent: refused,
      title: t.t("betSlip.alerts.oddsChangedTitle"),
      body: refused
        ? t.t("betSlip.refused.oddsChanged")
        : t.t("betSlip.alerts.oddsChangedBody", {
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
          role={alert.tone === "error" || alert.urgent ? "alert" : "status"}
          className={cn(
            "mx-3 mb-2.5 flex flex-wrap items-center gap-2.5 rounded-md py-2.5 pr-2 pl-3",
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
            {/* On a tinted alert, muted text would fall under AA in the light
                theme: the body and detail carry the instructions. */}
            {alert.body && (
              <div
                className={cn(
                  "text-xs",
                  alert.tone === "info" ? "text-muted" : "text-text/80",
                )}
              >
                {alert.body}
              </div>
            )}
            {alert.detail && (
              <div
                className={cn(
                  "text-xs",
                  alert.tone === "info" ? "text-muted" : "text-text/80",
                )}
              >
                {alert.detail}
              </div>
            )}
          </div>
          {alert.action && !alert.secondary && (
            <button
              type="button"
              onClick={alert.action.onClick}
              className="bg-raised text-text font-body min-h-11 shrink-0 cursor-pointer rounded-lg px-3 text-xs font-bold"
            >
              {alert.action.label}
            </button>
          )}
          {/* Two choices go under the text, side by side, so neither squeezes
              it in the narrow aside. */}
          {alert.action && alert.secondary && (
            <div className="grid w-full grid-cols-2 gap-2 pl-[27px]">
              <button
                type="button"
                onClick={alert.action.onClick}
                className="bg-raised text-text font-body min-h-11 cursor-pointer rounded-lg px-3 text-xs font-bold"
              >
                {alert.action.label}
              </button>
              <button
                type="button"
                onClick={alert.secondary.onClick}
                className="text-text font-body border-divider min-h-11 cursor-pointer rounded-lg border bg-transparent px-3 text-xs font-bold"
              >
                {alert.secondary.label}
              </button>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
