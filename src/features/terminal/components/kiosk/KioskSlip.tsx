"use client";

import { ArrowLeft, Lock, Ticket, X } from "lucide-react";
import { useBetSlipStore } from "@/features/bet-slip/stores/bet-slip.store";
import type { BetSelection } from "@/features/bet-slip/types";
import { useTranslation } from "@/lib/i18n/use-translation";

/**
 * The kiosk's slip (F8ca): the picks, each removable, and Clear all. No
 * stake, no figure and no button to bet yet: F8cb prices it with the shop's
 * rule set, F8cc turns it into a code for the counter. The store is the
 * player's slip store, unchanged.
 */
export function KioskSlip({
  titleId,
  onBack,
}: {
  titleId: string;
  /** Back to the board, below `lg` where the slip is a view of its own. */
  onBack: () => void;
}) {
  const t = useTranslation();
  const selections = useBetSlipStore((s) => s.selections);
  const clear = useBetSlipStore((s) => s.clear);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-divider flex min-h-16 items-center gap-3 border-b px-4">
        <button
          type="button"
          onClick={onBack}
          className="text-text -ml-2 grid size-12 cursor-pointer place-items-center rounded-md lg:hidden"
          aria-label={t.t("terminal.kiosk.backToMatches")}
        >
          <ArrowLeft className="size-6" aria-hidden />
        </button>
        <h2 id={titleId} className="text-xl font-bold">
          {t.t("betSlip.title")}
        </h2>
        {selections.length > 0 && (
          <button
            type="button"
            onClick={clear}
            className="text-muted hover:text-text ml-auto min-h-12 cursor-pointer rounded-md px-3 text-base font-bold"
          >
            {t.t("betSlip.clearAll")}
          </button>
        )}
      </div>

      {selections.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
          <Ticket className="text-muted size-10" aria-hidden />
          <p className="text-lg font-bold">{t.t("betSlip.emptyTitle")}</p>
          <p className="text-muted text-base">{t.t("betSlip.emptyBody")}</p>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto">
          {selections.map((selection) => (
            <KioskPick key={selection.outcomeId} selection={selection} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** One pick: the match, the market and the pick, at the price it was taken. */
function KioskPick({ selection }: { selection: BetSelection }) {
  const t = useTranslation();
  const remove = useBetSlipStore((s) => s.removeSelection);
  const pick = t.pick(selection.outcomeName);

  return (
    <li className="border-divider flex items-center gap-3 border-b px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-muted truncate text-sm">
          {t.pick(selection.eventName)}
        </span>
        <span className="text-base font-bold">{pick}</span>
        <span className="text-muted truncate text-sm">
          {t.pick(selection.marketName)}
        </span>
      </div>
      {selection.suspended ? (
        <span className="text-muted flex items-center gap-1 text-sm font-bold">
          <Lock className="size-4" aria-hidden />
          {t.t("betSlip.suspended")}
        </span>
      ) : (
        <span className="numeric text-lg font-extrabold">
          {t.odds(selection.currentOdds)}
        </span>
      )}
      <button
        type="button"
        onClick={() => remove(selection.outcomeId)}
        aria-label={t.t("betSlip.remove", { pick })}
        className="text-muted hover:text-text grid size-12 shrink-0 cursor-pointer place-items-center rounded-md"
      >
        <X className="size-6" aria-hidden />
      </button>
    </li>
  );
}
