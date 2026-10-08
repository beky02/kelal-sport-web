"use client";

import { useId } from "react";
import { Delete } from "lucide-react";
import {
  QuickStakes,
  StakeLines,
} from "@/features/bet-slip/components/StakeInput";
import type { BetSlipTotals } from "@/features/bet-slip/lib/calculate";
import { useBetSlipStore } from "@/features/bet-slip/stores/bet-slip.store";
import { useTranslation } from "@/lib/i18n/use-translation";

/** The keypad, row by row: a phone's order, the point and delete beside 0. */
const KEYS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  ".",
  "0",
  "delete",
] as const;

/**
 * `"50.00"` → `"50"`: a stake set from outside the keypad — a code's hint,
 * a fix — reads, and edits, as a typed one (review U4); the same amount.
 */
const plain = (amount: string) => amount.replace(/\.00$/, "");

/**
 * The kiosk's stake (F8cb): the total, typed on an on-screen keypad rather
 * than a text field, which on a touch PC would open the system's keyboard
 * over the slip. It is the player's stake field otherwise: the same row, its
 * C to clear, the same rules for what can be typed — every key goes through
 * the store's `setStake` (digits, one point, two decimals at most) — then how
 * the total splits across bets, and the rule set's quick stakes when it has
 * any. The stake is optional: a hint the counter sees on the code (C19 §4.2).
 */
export function KioskStake({
  totals,
  quickStakes,
}: {
  totals: BetSlipTotals;
  quickStakes: readonly string[];
}) {
  const t = useTranslation();
  // The slip is mounted twice below `xl` (the hidden column and the sheet),
  // so the label's id is per mount.
  const label = useId();
  const stake = plain(useBetSlipStore((s) => s.stake));
  const setStake = useBetSlipStore((s) => s.setStake);
  // Each key edits the amount shown.
  const press = (key: (typeof KEYS)[number]) =>
    setStake(key === "delete" ? stake.slice(0, -1) : stake + key);

  return (
    <div className="flex flex-col gap-2 px-4 pt-3">
      {/* 12 px: the floor for an Amharic label (review U3). */}
      <div id={label} className="text-muted text-xs">
        {t.t("betSlip.totalStake")}
      </div>

      <div className="bg-raised flex h-[46px] items-stretch overflow-hidden rounded-md">
        <span className="text-muted flex items-center px-3 font-bold">
          {t.t("header.currency")}
        </span>
        {/* Announced as it changes (`<output>` is a status), never a text box. */}
        <output
          aria-labelledby={label}
          className="font-body numeric text-text flex min-w-0 flex-1 items-center truncate px-1 text-[17px] font-bold"
        >
          {stake}
        </output>
        <button
          type="button"
          aria-label={t.t("betSlip.clearStake")}
          onClick={() => setStake("")}
          // A key, set off from the amount, as the keypad's are (review U2).
          className="border-divider text-text hover:bg-ground font-body w-12 cursor-pointer border-l bg-transparent text-[17px] font-bold"
        >
          C
        </button>
      </div>

      <StakeLines totals={totals} />

      <div
        role="group"
        aria-label={t.t("terminal.kiosk.keypad")}
        className="grid grid-cols-3 gap-1.5"
      >
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            aria-label={
              key === "."
                ? t.t("terminal.kiosk.keyPoint")
                : key === "delete"
                  ? t.t("terminal.kiosk.keyDelete")
                  : undefined
            }
            className="border-divider text-text font-body numeric hover:bg-raised grid h-11 cursor-pointer place-items-center rounded-md border bg-transparent text-[17px] font-bold"
          >
            {key === "delete" ? (
              <Delete size={18} strokeWidth={1.75} aria-hidden />
            ) : key === "." ? (
              // The point, large enough to read as a key (review U2).
              <span aria-hidden className="text-[28px] leading-none">
                .
              </span>
            ) : (
              key
            )}
          </button>
        ))}
      </div>

      <QuickStakes amounts={quickStakes} />
    </div>
  );
}
