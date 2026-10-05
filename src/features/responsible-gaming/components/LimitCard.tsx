"use client";

import { useId, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { ApiError } from "@/lib/api/errors";
import { useDateTimeText } from "@/lib/i18n/use-date-time-text";
import type { MessageKey } from "@/lib/i18n";
import { useTranslation } from "@/lib/i18n/use-translation";
import { sanitiseAmount } from "@/lib/money";
import { cn } from "@/lib/utils/cn";
import { useChangeLimit } from "../hooks/use-responsible-gaming";
import { isProblem } from "../lib/break";
import { limitFor, limitValue, moneyType, openingPeriod } from "../lib/limits";
import type { LimitPeriod, LimitType, RgLimit } from "../types";
import { PERIOD_LABEL, UsedBar, pendingText, valueText } from "./LimitLines";

const TITLE: Record<LimitType, MessageKey> = {
  deposit: "rg.depositLimit",
  stake: "rg.stakeLimit",
  loss: "rg.lossLimit",
  session_minutes: "rg.timeLimit",
};

const BODY: Record<LimitType, MessageKey> = {
  deposit: "rg.depositLimitBody",
  stake: "rg.stakeLimitBody",
  loss: "rg.lossLimitBody",
  session_minutes: "rg.timeLimitBody",
};

/**
 * One kind of limit — deposit, stake, loss or time — per day, week or month,
 * exactly as the account holds it (AC-1): the limit, what the current period
 * has used, and any change the API is holding back with when it applies.
 *
 * Saving sends the new value and shows what the API answered: in force at
 * once, or pending until the API's time (AC-5). Whether a change is a rise or
 * a cut is never worked out here — the API decides, and says so. The period
 * stays put while a save is on its way, so its answer is never lost; Save
 * keeps focus, and what the API said goes into a region already on the page,
 * so it is read out.
 */
export function LimitCard({
  type,
  limits,
}: {
  type: LimitType;
  /** Every limit the player has: this card shows its own type's. */
  limits: readonly RgLimit[];
}) {
  const t = useTranslation();
  const when = useDateTimeText();
  const titleId = useId();
  const labelId = useId();
  const inputId = useId();
  const hintId = useId();

  const [period, setPeriod] = useState<LimitPeriod>(() =>
    openingPeriod(limits, type),
  );
  const [typed, setTyped] = useState("");
  const change = useChangeLimit();

  const limit = limitFor(limits, type, period);
  const shown = limit ? valueText(limit, t) : null;
  const value = limitValue(type, typed);
  const sendable = typeof value === "object";
  const minutes = type === "session_minutes";

  const hint =
    value === "tooLow"
      ? t.t(minutes ? "rg.minutesTooLow" : "rg.amountTooLow")
      : value === "tooHigh"
        ? t.t(minutes ? "rg.minutesTooHigh" : "rg.amountTooHigh")
        : null;

  const save = () => {
    if (!sendable || change.isPending) return;
    change.mutate(
      "minutes" in value
        ? { type: "session_minutes", period, minutes: value.minutes }
        : { type: moneyType(type), period, amount: value.amount },
      // Saved: the value is the account's now, said under the button. A
      // refusal or no answer keeps it typed, to change or send again.
      { onSuccess: () => setTyped("") },
    );
  };

  const switchTo = (next: LimitPeriod) => {
    if (change.isPending) return;
    setPeriod(next);
    setTyped("");
    change.reset();
  };

  // What the last save came back with, for this period.
  const answer = change.data;
  const saved =
    answer && answer.period === period
      ? answer.pending
        ? answer.pending.amount === null && answer.pending.minutes === null
          ? t.t("rg.pendingRemoved", {
              date: when(answer.pending.effectiveFrom),
            })
          : t.t("rg.savedPending", {
              value: valueText(answer.pending, t) ?? "",
              date: when(answer.pending.effectiveFrom),
            })
        : t.t("rg.savedNow", { value: valueText(answer, t) ?? "" })
      : null;
  const failure = change.error;

  return (
    <Card className="flex flex-col gap-3 p-3.5">
      <section aria-labelledby={titleId} className="flex flex-col gap-3">
        <div>
          <h3 id={titleId} className="font-display text-base">
            {t.t(TITLE[type])}
          </h3>
          <p className="text-muted text-xs text-pretty">{t.t(BODY[type])}</p>
        </div>

        <Segmented<LimitPeriod>
          value={period}
          onChange={switchTo}
          options={(["day", "week", "month"] as const).map((option) => ({
            value: option,
            label: t.t(PERIOD_LABEL[option]),
            // Its answer belongs to this period: wait for it before another.
            disabled: change.isPending,
          }))}
        />

        {limit === null || shown === null ? (
          <p className="text-muted text-sm">{t.t("rg.noLimit")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="numeric font-semibold">
              {t.t("rg.limitValue", { value: shown })}
            </p>
            {limit.used !== null && limit.amount !== null && (
              <UsedBar
                used={limit.used}
                amount={limit.amount}
                period={period}
              />
            )}
            {limit.pending && (
              <p className="text-muted numeric text-xs">
                {pendingText(limit.pending, t, when)}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label
            id={labelId}
            htmlFor={inputId}
            className="text-xs font-semibold"
          >
            {t.t("rg.newLimit")}
          </label>
          <div className="bg-raised focus-within:outline-accent flex h-12 rounded-md focus-within:outline-2 focus-within:outline-offset-2">
            <span className="border-divider text-muted flex items-center border-r px-3 font-semibold">
              {minutes ? t.t("rg.minutesUnit") : t.t("header.currency")}
            </span>
            <input
              id={inputId}
              inputMode={minutes ? "numeric" : "decimal"}
              autoComplete="off"
              aria-labelledby={`${titleId} ${labelId}`}
              aria-describedby={hint ? hintId : undefined}
              aria-invalid={hint ? true : undefined}
              value={typed}
              onChange={(event) =>
                setTyped(
                  minutes
                    ? event.target.value.replace(/\D/g, "").slice(0, 7)
                    : sanitiseAmount(event.target.value),
                )
              }
              className="font-body numeric text-text min-w-0 flex-1 border-0 bg-transparent px-3 text-[17px] font-semibold outline-none"
            />
          </div>
          {hint && (
            <p id={hintId} className="text-loss text-xs">
              {hint}
            </p>
          )}
        </div>

        <div className="flex flex-col">
          {/* Off by aria-disabled, never disabled: the player who just saved
              keeps their focus here. */}
          <button
            type="button"
            onClick={save}
            aria-busy={change.isPending || undefined}
            aria-disabled={!sendable || change.isPending || undefined}
            className={cn(
              "bg-raised text-text font-body flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-bold",
              change.isPending
                ? "cursor-wait"
                : !sendable && "cursor-not-allowed opacity-45",
            )}
          >
            {change.isPending && (
              <Loader2 size={16} className="animate-spin" aria-hidden />
            )}
            {change.isPending ? t.t("rg.saving") : t.t("rg.saveLimit")}
          </button>
          {/* Always rendered — empty, it takes no room — so what it says
              next is announced. */}
          <p
            role="status"
            className="numeric mt-2 text-xs font-semibold empty:mt-0"
          >
            {saved}
          </p>
        </div>

        {failure && <SaveFailed error={failure} />}
      </section>
    </Card>
  );
}

/**
 * A save that didn't go: the API's no in its own words, or no answer at all —
 * saving again sends the same value, which changes nothing more.
 */
function SaveFailed({ error }: { error: Error }) {
  const t = useTranslation();
  // A lost session is /api/me's to say: the page turns to the guest's.
  if (error instanceof ApiError && error.status === 401) return null;
  const refused =
    error instanceof ApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 429;
  const detail =
    refused && error.details && typeof error.details === "object"
      ? (error.details as { detail?: unknown }).detail
      : undefined;
  return (
    <div role="alert" className="bg-loss-bg rounded-md p-3 text-xs">
      <p className="font-bold">
        {t.t(refused ? "rg.notSavedTitle" : "rg.saveFailedTitle")}
      </p>
      <p className="text-text/80">
        {!refused
          ? t.t("rg.saveFailedBody")
          : // The API's own title — unless the answer wasn't a Problem,
            // whose only words are this app's technical ones.
            isProblem(error)
            ? error.message
            : t.t("rg.refusedBody")}
      </p>
      {typeof detail === "string" && <p className="text-text/80">{detail}</p>}
    </div>
  );
}
