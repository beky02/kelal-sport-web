"use client";

import { CircleAlert } from "lucide-react";
import type { Quote, RuleSetJson } from "@golden/slipcalc";
import type { Translator } from "@/lib/i18n/use-translation";
import { normaliseMoney } from "@/lib/money";
import { cn } from "@/lib/utils/cn";
import type { SlipProblem } from "../lib/calculate";

type Tone = "error" | "warn" | "info";

/**
 * One alert on the slip: what is blocking or qualifying it, and the fix as a
 * button where there is one. Shared by the player's slip (`SlipAlerts`) and
 * the kiosk's (F8cb), so both say the same thing about the same slip.
 */
export interface SlipAlert {
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

/**
 * A refusal from slipcalc, with the change that would make it go through. A
 * stake under the minimum has none here: the stake field itself says so
 * (`StakeInput`, the user's decision of 2026-10-08).
 */
export function problemAlert(
  problem: SlipProblem,
  t: Translator,
  fix: { setStake: (s: string) => void; useMultiple: () => void },
): SlipAlert | null {
  switch (problem.code) {
    case "BET_STAKE_TOO_LOW":
      return null;
    case "BET_STAKE_TOO_HIGH": {
      const amount = t.money(problem.stake);
      return {
        id: problem.code,
        tone: "error",
        title: t.t("betSlip.errors.stakeTooHighTitle"),
        body: t.t("betSlip.errors.stakeTooHighBody", { amount }),
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
 * Two picks from one match can't be combined (BET-02). A tap replaces the
 * match's pick (F3c), so only a loaded code can bring two; removing one is
 * the player's call, so there is no button.
 */
export function conflictAlert(t: Translator): SlipAlert {
  return {
    id: "conflict",
    tone: "error",
    title: t.t("betSlip.alerts.conflictTitle"),
    body: t.t("betSlip.alerts.conflictBody"),
  };
}

/**
 * A pick that can't be priced, with Remove. After the engine refused the bet
 * for it (`refused`), it says so, and which it was: the match started, or the
 * market was suspended.
 */
export function suspendedAlert(
  t: Translator,
  remove: () => void,
  refused: "started" | "suspended" | null = null,
): SlipAlert {
  const started = refused === "started";
  return {
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
        : refused === "suspended"
          ? "betSlip.refused.suspended"
          : "betSlip.alerts.suspendedBody",
    ),
    action: { label: t.t("betSlip.alerts.removeIt"), onClick: remove },
  };
}

/**
 * D1's warnings on a priced slip, as information: a stake remainder not
 * charged (with the stake as typed), a capped bonus, the payout cap reached.
 */
export function warningAlerts(
  quote: Quote,
  rules: RuleSetJson,
  stake: string,
  t: Translator,
): SlipAlert[] {
  return quote.warnings.flatMap((warning): SlipAlert[] => {
    switch (warning) {
      case "STAKE_REMAINDER_NOT_CHARGED":
        return [
          {
            id: warning,
            tone: "info",
            title: t.t("betSlip.warnings.remainder", {
              amount: t.money(normaliseMoney(stake.replace(/\.$/, ""))),
              lines: quote.lines,
              charged: t.money(quote.totalStake),
            }),
          },
        ];
      case "ACCA_BONUS_CAPPED":
        return [
          {
            id: warning,
            tone: "info",
            title: t.t("betSlip.warnings.bonusCapped", {
              amount: t.money(rules.acca_bonus_max),
            }),
          },
        ];
      case "MAX_PAYOUT_REACHED":
        return [
          {
            id: warning,
            tone: "info",
            title: t.t("betSlip.warnings.maxPayout", {
              amount: t.money(rules.max_payout),
            }),
          },
        ];
      default:
        return [];
    }
  });
}

/**
 * The slip's alerts, most severe first as given. Errors are red and stop the
 * bet; a warning is amber; D1's warnings are information.
 */
export function AlertList({ alerts }: { alerts: readonly SlipAlert[] }) {
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
  action: NonNullable<SlipAlert["action"]>;
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
