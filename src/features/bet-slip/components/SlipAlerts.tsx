"use client";

import type { RuleSetJson } from "@golden/slipcalc";
import { useBreak } from "@/features/responsible-gaming/hooks/use-responsible-gaming";
import { useLongDateTimeText } from "@/lib/i18n/use-long-date-time-text";
import { useTranslation, type Translator } from "@/lib/i18n/use-translation";
import { useBetSlipStore, type Placement } from "../stores/bet-slip.store";
import type { BetSlipTotals } from "../lib/calculate";
import type { PlaceAttempt } from "../types";
import {
  refusalNotice,
  type RefusalNotice,
  type RefusalText,
} from "../lib/refusals";
import {
  AlertList,
  conflictAlert,
  problemAlert,
  suspendedAlert,
  warningAlerts,
  type SlipAlert,
} from "./AlertList";

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
): SlipAlert {
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

  const alerts: SlipAlert[] = [];

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
    alerts.push(conflictAlert(t, () => setMode("single")));
  }

  if (totals.suspendedSelection) {
    const id = totals.suspendedSelection.outcomeId;
    // After the engine refused the bet for it, say so — and which it was.
    const started = firstTry && refused.problem.code === "BET_EVENT_STARTED";
    const paused = firstTry && refused.problem.code === "BET_MARKET_SUSPENDED";
    alerts.push(
      suspendedAlert(
        t,
        () => removeSelection(id),
        started ? "started" : paused ? "suspended" : null,
      ),
    );
  }

  const problem =
    totals.problem &&
    problemAlert(totals.problem, t, {
      setStake,
      useMultiple: () => setMode("multiple"),
    });
  if (problem) alerts.push(problem);

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
  if (quote && rules) alerts.push(...warningAlerts(quote, rules, stake, t));

  return <AlertList alerts={alerts} />;
}
