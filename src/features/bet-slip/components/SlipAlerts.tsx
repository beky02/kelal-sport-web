"use client";

import { CircleAlert } from "lucide-react";
import type { RuleSetJson } from "@golden/slipcalc";
import { useBreak } from "@/features/responsible-gaming/hooks/use-responsible-gaming";
import { useLongDateTimeText } from "@/lib/i18n/use-long-date-time-text";
import { useTranslation, type Translator } from "@/lib/i18n/use-translation";
import { normaliseMoney } from "@/lib/money";
import { cn } from "@/lib/utils/cn";
import { useBetSlipStore, type Placement } from "../stores/bet-slip.store";
import type { BetSlipTotals, SlipProblem } from "../lib/calculate";
import type { PlaceAttempt } from "../types";
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
  action?: {
    label: string;
    onClick: () => void;
    /** Its own request is on its way: announced as busy, and off meanwhile. */
    busy?: boolean;
    /** Off while another request is on its way, still focusable. */
    off?: boolean;
  };
  /** The action goes under the text, full width: its label carries an amount. */
  below?: boolean;
}

/** What the slip can do about the engine's answer. */
export interface PlacementFixes {
  /** Send the unconfirmed bet again: its own request and key. */
  retry: () => void;
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

/**
 * A bet as the slip names it — "Multiple · 3 picks", "System 2/4 · 6 bets" —
 * for one that is no longer on screen. Its spaces don't break: a name split
 * across lines, or a line starting with "·", reads as two things.
 */
function kindOf(attempt: PlaceAttempt, t: Translator): string {
  const { betType, legs, systemSizes } = attempt.request;
  const n = legs.length;
  const name =
    betType === "multiple"
      ? t.t("betSlip.multipleLabel", { n })
      : betType === "system"
        ? t.t("betSlip.systemLabel", {
            k: systemSizes.join(", "),
            n,
            c: attempt.lines,
          })
        : n === 1
          ? t.t("betSlip.single")
          : t.t("betSlip.singlesLabel", { n });
  return name.replace(/ /g, "\u00a0");
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
 * A bet the engine never answered comes first, and stays until a ticket
 * comes back; a refusal follows it, and stays until the slip changes or
 * another attempt goes.
 */
export function SlipAlerts({
  totals,
  balance,
  rules,
  rulesState,
  onRetryRules,
  placement,
  unconfirmedNote,
  fixes,
}: {
  totals: BetSlipTotals;
  /** The cash balance as `/api/wallet` sent it; null for a guest or while it loads. */
  balance: string | null;
  rules: RuleSetJson | null;
  rulesState: "loading" | "ready" | "error";
  onRetryRules: () => void;
  /** The signed-in player's own placement (`ownPlacement`). */
  placement: Placement;
  /**
   * What the unconfirmed alert says about the bet Try again sends: nothing
   * while the slip is exactly it; "as it was" while Try again would send
   * something the slip doesn't show (other prices, another odds setting, an
   * empty slip); and the two-bets warning once the main button would place
   * the slip as another bet.
   */
  unconfirmedNote: "asItWas" | "changed" | null;
  fixes: PlacementFixes;
}) {
  const t = useTranslation();
  const endText = useLongDateTimeText();
  // A break the player took, as /api/me reports it: the slip is paused.
  const pause = useBreak();
  const breakUntil = pause?.until ? endText(pause.until) : null;
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
  // the same key, its amount on the button; a different bet only by the
  // player's explicit choice.
  const { unconfirmed, sending } = placement;
  if (unconfirmed) {
    const retrying = sending?.key === unconfirmed.key;
    alerts.push({
      id: "unconfirmed",
      tone: "error",
      title: t.t("betSlip.unconfirmed.title"),
      body: t.t("betSlip.unconfirmed.body"),
      // Whenever Try again would send what the slip doesn't show, say which
      // bet it sends — and, once the slip is another bet, that placing it as
      // well makes two.
      detail: unconfirmedNote
        ? t.t(
            unconfirmedNote === "changed"
              ? "betSlip.unconfirmed.changed"
              : "betSlip.unconfirmed.asItWas",
            { bet: kindOf(unconfirmed, t) },
          )
        : null,
      action: {
        label: retrying
          ? t.t("betSlip.placing")
          : t.t("betSlip.unconfirmed.retry", {
              amount: t.money(unconfirmed.totalStake),
            }),
        onClick: fixes.retry,
        busy: retrying,
        off: sending !== null,
      },
      below: true,
    });
  }

  // A refusal. One of a Try again says nothing about the bet's first try, so
  // nothing may say "your bet wasn't placed"; one of any other attempt — a
  // first try, or a bet placed as new — spent that attempt's key.
  const refused = placement.refused;
  const retried = refused !== null && refused.key === unconfirmed?.key;
  const firstTry = refused !== null && !retried;
  const notice = refused
    ? refusalNotice(refused.problem, {
        lines: totals.lineCount,
        rules,
        pickChanged: totals.pendingOddsChanges.length > 0,
        pickClosed: totals.suspendedSelection !== null,
        retried,
        breakUntil,
      })
    : null;
  // During a break the slip says so once: a first try refused for the break
  // is that same message, announced, with the API's own detail. A Try again's
  // refusal keeps its own title — it says nothing about the first try.
  const refusedForBreak =
    firstTry &&
    (refused.problem.code === "RG_SELF_EXCLUDED" ||
      refused.problem.code === "RG_COOLING_OFF");
  if (pause) {
    alerts.unshift({
      id: "paused",
      tone: "warn",
      urgent: refusedForBreak,
      title: t.t("betSlip.refused.breakTitle"),
      body: breakUntil
        ? t.t("betSlip.refused.breakUntil", { date: breakUntil })
        : t.t("betSlip.refused.break"),
      detail: refusedForBreak ? notice?.detail : null,
      // On a phone the open slip covers the banner: its own way to the limits.
      action: { label: t.t("system.viewLimits"), onClick: fixes.viewLimits },
    });
  }
  if (notice && !(pause && refusedForBreak)) {
    alerts.push(refusalAlert(notice, t, { ...fixes, setStake }));
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
    // After the engine refused the bet for it, say so — and which it was.
    const started = firstTry && refused.problem.code === "BET_EVENT_STARTED";
    const paused = firstTry && refused.problem.code === "BET_MARKET_SUSPENDED";
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
    const oddsRefused = firstTry && refused.problem.code === "BET_ODDS_CHANGED";
    alerts.push({
      id: "odds",
      tone: "warn",
      urgent: oddsRefused,
      title: t.t("betSlip.alerts.oddsChangedTitle"),
      body: oddsRefused
        ? t.t("betSlip.refused.oddsChanged")
        : t.t("betSlip.alerts.oddsChangedBody"),
      action: {
        label: t.t("betSlip.acceptAll"),
        onClick: acceptAllPending,
      },
    });
  }

  // The player's balance, as the API sent it — the figure the stake was
  // compared with, never the stake itself.
  if (totals.insufficientBalance && balance !== null) {
    alerts.push({
      id: "balance",
      tone: "error",
      title: t.t("betSlip.alerts.insufficientTitle"),
      body: t.t("betSlip.alerts.insufficientBody", {
        amount: t.money(balance),
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
          {alert.action && !alert.below && (
            <AlertButton action={alert.action} className="shrink-0" />
          )}
          {/* An amount makes a long label: under the text, so it doesn't
              squeeze it in the narrow aside. */}
          {alert.action && alert.below && (
            <div className="w-full pl-[27px]">
              <AlertButton action={alert.action} className="w-full" />
            </div>
          )}
        </div>
      ))}
    </>
  );
}

function AlertButton({
  action,
  className,
}: {
  action: NonNullable<Alert["action"]>;
  className: string;
}) {
  // Off by aria-disabled, not disabled: the player keeps their focus here.
  const off = action.busy || action.off;
  return (
    <button
      type="button"
      onClick={off ? undefined : action.onClick}
      aria-disabled={off || undefined}
      aria-busy={action.busy || undefined}
      className={cn(
        "bg-raised text-text font-body min-h-11 cursor-pointer rounded-lg px-3 text-xs font-bold aria-disabled:cursor-not-allowed aria-disabled:opacity-60",
        className,
      )}
    >
      {action.label}
    </button>
  );
}
