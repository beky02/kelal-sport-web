"use client";

import { useMemo, useRef, useState } from "react";
import { Ticket } from "lucide-react";
import type { RuleSetJson } from "@golden/slipcalc";
import { Sheet } from "@/components/ui/Sheet";
import {
  AlertList,
  conflictAlert,
  problemAlert,
  suspendedAlert,
  warningAlerts,
  type SlipAlert,
} from "@/features/bet-slip/components/AlertList";
import { SlipTabs } from "@/features/bet-slip/components/SlipTabs";
import { BetSelectionRow } from "@/features/bet-slip/components/BetSelectionRow";
import { BetSlipHeader } from "@/features/bet-slip/components/BetSlipHeader";
import { EmptySlip } from "@/features/bet-slip/components/EmptySlip";
import { LoadBookingCode } from "@/features/bet-slip/components/BookingCode";
import { PayoutSummary } from "@/features/bet-slip/components/PayoutSummary";
import { SlipSummary } from "@/features/bet-slip/components/SlipSummary";
import { StakeInput } from "@/features/bet-slip/components/StakeInput";
import { BookingNotice } from "@/features/bookings/components/BookingNotice";
import {
  calculateBetSlip,
  type BetSlipTotals,
} from "@/features/bet-slip/lib/calculate";
import { useBetSlipStore } from "@/features/bet-slip/stores/bet-slip.store";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useTerminalConfig } from "../../hooks/use-kiosk";
import { useBookSlip } from "../../hooks/use-slip-code";
import { slipCodeRequestFrom } from "../../lib/slip-code";
import { BookBet } from "./BookBet";

/**
 * The kiosk's slip (F8ca, priced in F8cb), from the player's slip parts: its
 * header with Clear all, the slips' tabs, a row per pick, Book bet — which
 * makes the 8-digit slip code the counter sells from (F8cc) — and Load
 * booking code where the tenant has codes. Its figures are slipcalc's on the
 * shop's rule set (`retail_betting`, D1.12) and nothing else: the player's
 * `SlipSummary` and `PayoutSummary`, with slipcalc's refusals and their fixes
 * above. The stake is optional, typed in the player's stake field (the
 * user's review: no on-screen keypad), with no balance beside it.
 *
 * A pick is priced at its odds when tapped, or a loaded code's current odds;
 * nothing asks to accept a move, since nothing is placed here — the counter
 * re-prices the slip code at sale (C19 §4.3, §14). There is no balance, login
 * or Place. A tenant without a shop rule set gets the picks and no figure:
 * never the online rule set's. The store is the player's slip store.
 */
export function KioskSlip({ onClose }: { onClose?: () => void }) {
  const t = useTranslation();
  const selections = useBetSlipStore((s) => s.selections);
  const mode = useBetSlipStore((s) => s.mode);
  const systemK = useBetSlipStore((s) => s.systemK);
  const typed = useBetSlipStore((s) => s.stake);
  const config = useTerminalConfig().data;
  const bookingCodes = config?.bookingCodes ?? false;
  const rules = config?.rules ?? null;
  // Without the shop's rules there is nothing to check a stake against, so
  // none is priced, shown or sent — not even a loaded code's hint.
  const stake = rules ? typed : "";
  const totals = useMemo(
    () =>
      calculateBetSlip({
        selections,
        mode,
        stake,
        systemK,
        rules: rules?.calc ?? null,
        balance: null,
        // Nothing is placed here, so no move waits for a yes.
        oddsPolicy: "any",
      }),
    [selections, mode, stake, systemK, rules],
  );
  const conflicts = useMemo(
    () => new Set(totals.conflictEventIds),
    [totals.conflictEventIds],
  );
  const request = useMemo(
    () => slipCodeRequestFrom({ selections, totals, stake }),
    [selections, totals, stake],
  );
  const booking = useBookSlip();

  return (
    // The player's slip body (`BetSlip`), so its tiles and rows read the same.
    <div className="bg-ground flex w-full flex-col pb-3">
      <BetSlipHeader count={totals.count} onClose={onClose} />
      <SlipTabs />
      <KioskSlipAlerts
        totals={totals}
        rules={rules?.calc ?? null}
        stake={stake}
      />
      <BookingNotice
        priced={
          rules
            ? {
                mode: totals.mode,
                systemK: totals.systemK,
                liveCount: totals.liveCount,
              }
            : null
        }
      />
      {totals.count === 0 ? (
        <EmptySlip />
      ) : (
        <>
          <div className="bg-surface mx-3 overflow-hidden rounded-lg">
            {selections.map((selection, index) => (
              <BetSelectionRow
                key={selection.outcomeId}
                selection={selection}
                first={index === 0}
                conflict={conflicts.has(selection.eventId)}
                pending={false}
              />
            ))}
          </div>
          {rules ? (
            <>
              <StakeInput
                totals={totals}
                quickStakes={rules.quickStakes}
                balance={null}
              />
              <SlipSummary totals={totals} />
            </>
          ) : (
            // The user's wording (F8cb plan gate): no figure, and where to ask
            // — a notice, as the slip's others are (review U6).
            <div className="mt-3">
              <AlertList
                alerts={[
                  {
                    id: "no-rules",
                    tone: "info",
                    title: t.t("terminal.kiosk.noRules"),
                  },
                ]}
              />
            </div>
          )}
          {/* What the customer came for, always in reach: the picks and the
              stake scroll beneath it, in the column and in the sheet
              (review U1). */}
          <div className="bg-ground sticky bottom-0 z-10 pb-1 shadow-[0_-12px_12px_-12px_rgb(0_0_0/0.5)]">
            {rules && <PayoutSummary totals={totals} rules={rules.calc} />}
            <BookBet
              request={request}
              lines={totals.lineCount}
              booking={booking}
            />
          </div>
        </>
      )}
      {/* A code replaces the slip: offered only while it is empty (the user's
          review, 2026-10-08). */}
      {bookingCodes && totals.count === 0 && <LoadBookingCode />}
    </div>
  );
}

/**
 * The slip's own alerts, as the player's slip words them (`AlertList`): two
 * picks of one match, a pick that can't be priced, slipcalc's refusal with
 * its fix (the shop's minimum or maximum as a tap, Use multiple), and D1's
 * warnings. Nothing about placing, a balance or a break: none exist here.
 */
function KioskSlipAlerts({
  totals,
  rules,
  stake,
}: {
  totals: BetSlipTotals;
  rules: RuleSetJson | null;
  /** The stake the slip priced: none without the shop's rules (review Q1). */
  stake: string;
}) {
  const t = useTranslation();
  const setStake = useBetSlipStore((s) => s.setStake);
  const setMode = useBetSlipStore((s) => s.setMode);
  const removeSelection = useBetSlipStore((s) => s.removeSelection);

  const alerts: SlipAlert[] = [];
  if (totals.hasConflict) {
    alerts.push(conflictAlert(t));
  }
  const suspended = totals.suspendedSelection;
  if (suspended) {
    alerts.push(suspendedAlert(t, () => removeSelection(suspended.outcomeId)));
  }
  const problem =
    totals.problem &&
    problemAlert(totals.problem, t, {
      setStake,
      useMultiple: () => setMode("multiple"),
    });
  if (problem) alerts.push(problem);
  if (totals.quote && rules) {
    alerts.push(...warningAlerts(totals.quote, rules, stake, t));
  }
  return <AlertList alerts={alerts} />;
}

/**
 * Below `xl`, where the slip has no column of its own: a bar that counts the
 * picks and opens it as a sheet, as on the player's site (`MobileBetSlip`).
 */
export function KioskMobileSlip() {
  const t = useTranslation();
  const count = useBetSlipStore((s) => s.selections.length);
  const [open, setOpen] = useState(false);
  const bar = useRef<HTMLButtonElement>(null);

  return (
    <>
      {/* Always available so a customer can load a booking code into an empty
          slip on a phone. It stays mounted under the sheet for focus return. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] xl:hidden">
        <button
          ref={bar}
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t.t("nav.slipAria", { n: count })}
          className="bg-accent text-on-accent font-body pointer-events-auto flex h-12 cursor-pointer items-center gap-2.5 rounded-full px-5 text-sm font-bold shadow-[0_8px_24px_rgb(0_0_0/0.35)]"
        >
          <Ticket size={17} strokeWidth={1.5} aria-hidden />
          {t.t("betSlip.title")}
          {count > 0 && (
            <span className="bg-on-accent/20 grid size-[22px] place-items-center rounded-full text-xs font-extrabold">
              {count}
            </span>
          )}
        </button>
      </div>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={t.t("betSlip.title")}
        className="xl:hidden"
        returnFocusTo={bar}
      >
        <KioskSlip onClose={() => setOpen(false)} />
      </Sheet>
    </>
  );
}
