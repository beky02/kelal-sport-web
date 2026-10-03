"use client";

import { Lock, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { compareOdds } from "@/lib/money";
import { cn } from "@/lib/utils/cn";
import { useBetSlipStore } from "../stores/bet-slip.store";
import { oddsMoved, type BetSelection } from "../types";

/**
 * One pick in the slip.
 *
 * A moved price is always shown as old → new. When the odds policy needs the
 * player's yes, it has its own Accept, so a user with four picks can take the
 * one that moved and leave the rest — the alert's "accept all" is the
 * shortcut, not the only way.
 */
export function BetSelectionRow({
  selection,
  first,
  conflict,
  pending,
}: {
  selection: BetSelection;
  first: boolean;
  /** Shares a match with another pick, which a multiple cannot combine. */
  conflict: boolean;
  /** Price moved, and the odds policy needs the player to accept it. */
  pending: boolean;
}) {
  const t = useTranslation();
  const removeSelection = useBetSlipStore((s) => s.removeSelection);
  const acceptSelection = useBetSlipStore((s) => s.acceptSelection);

  const pick = t.pick(selection.outcomeName);
  const rising = compareOdds(selection.currentOdds, selection.initialOdds) > 0;
  const moved = oddsMoved(selection) && !selection.suspended;

  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto_44px] items-center gap-x-2 py-2.5 pl-3",
        !first && "border-divider border-t",
        selection.suspended && "opacity-60",
        conflict && "bg-loss-bg",
      )}
    >
      <div className="flex min-w-0 flex-col gap-px">
        <div className="text-muted text-[11px]">
          {t.pick(selection.marketName)}
        </div>
        <div className="text-sm font-bold">{pick}</div>
        <div className="text-muted truncate text-[11px]">
          {t.pick(selection.eventName)}
        </div>

        {conflict && (
          <div className="text-loss text-[11px] font-bold">
            {t.t("betSlip.sameMatchAsAnother")}
          </div>
        )}

        {selection.suspended && (
          <div className="text-muted flex items-center gap-1 text-[11px] font-bold">
            <Lock size={11} strokeWidth={2} aria-hidden />
            {t.t("betSlip.suspended")}
          </div>
        )}
      </div>

      <div className="numeric flex flex-col items-end gap-1">
        {moved ? (
          <>
            <span className="flex items-baseline gap-1.5">
              <span className="text-muted text-[11px] line-through">
                {t.odds(selection.initialOdds)}
              </span>
              <span
                className={cn(
                  "text-[15px] font-extrabold",
                  rising ? "text-win" : "text-loss",
                )}
              >
                {rising ? "▲" : "▼"} {t.odds(selection.currentOdds)}
              </span>
            </span>
            {pending && (
              // A 44 px target (a fix, after a 409) around the small pill.
              <button
                type="button"
                onClick={() => acceptSelection(selection.outcomeId)}
                className="font-body -my-2 flex h-11 cursor-pointer items-center bg-transparent"
              >
                <span className="bg-accent text-on-accent flex h-7 items-center rounded-md px-2.5 text-[11px] font-bold">
                  {t.t("betSlip.accept")}
                </span>
              </button>
            )}
          </>
        ) : (
          <span
            className={cn(
              "text-[15px] font-extrabold",
              selection.suspended ? "text-muted line-through" : "text-text",
            )}
          >
            {t.odds(selection.currentOdds)}
          </span>
        )}
      </div>

      <button
        type="button"
        aria-label={t.t("betSlip.remove", { pick })}
        onClick={() => removeSelection(selection.outcomeId)}
        className="text-muted hover:text-text grid size-11 cursor-pointer place-items-center bg-transparent"
      >
        <X size={15} strokeWidth={1.5} aria-hidden />
      </button>
    </div>
  );
}
