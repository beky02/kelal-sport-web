"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { routes } from "@/config/routes";
import { cn } from "@/lib/utils/cn";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { useBetSlip } from "../hooks/use-bet-slip";
import { usePlaceBet } from "../hooks/use-place-bet";
import { placeRequestFrom } from "../lib/placement";
import { useBetSlipStore } from "../stores/bet-slip.store";
import { BetModeTabs } from "./BetModeTabs";
import { BetPlacedConfirmation } from "./BetPlacedConfirmation";
import { BetSelectionRow } from "./BetSelectionRow";
import { BetSlipHeader } from "./BetSlipHeader";
import { BookingNotice } from "@/features/bookings/components/BookingNotice";
import {
  signatureOf,
  useCreateBooking,
} from "@/features/bookings/hooks/use-bookings";
import { bookingErrorMessage } from "@/features/bookings/lib/errors";
import { bookingRequestFrom } from "@/features/bookings/lib/request";
import { BookingAlert, BookingCode, LoadBookingCode } from "./BookingCode";
import { EmptySlip } from "./EmptySlip";
import { OddsPolicySetting } from "./OddsPolicySetting";
import { PayoutSummary } from "./PayoutSummary";
import { PlaceBetButton } from "./PlaceBetButton";
import { SlipAlerts } from "./SlipAlerts";
import { StakeInput } from "./StakeInput";
import { TaxBreakdown } from "./TaxBreakdown";

/**
 * The bet slip.
 *
 * Same component in the desktop aside and the mobile sheet — only `onClose`
 * differs, because only the sheet can be dismissed. Every number on screen comes
 * from `useBetSlip`, and the confirmation is the engine's ticket. Placing —
 * the attempt, a refusal, the ticket — lives in the slip store, so both
 * mounted slips show the same state and a closed sheet loses none of it.
 */
export function BetSlip({ onClose }: { onClose?: () => void }) {
  const t = useTranslation();
  const router = useRouter();

  const openAuth = useAuthStore((s) => s.open);
  const {
    totals,
    cta,
    isGuest,
    balance,
    rules,
    oddsPolicy,
    rulesState,
    retryRules,
    bookingCodes,
  } = useBetSlip();
  const selections = useBetSlipStore((s) => s.selections);
  const clear = useBetSlipStore((s) => s.clear);
  const setOddsPolicy = useBetSlipStore((s) => s.setOddsPolicy);
  const setStake = useBetSlipStore((s) => s.setStake);
  const stake = useBetSlipStore((s) => s.stake);

  const placement = useBetSlipStore((s) => s.placement);
  const dismissReceipt = useBetSlipStore((s) => s.dismissReceipt);
  const { place, retry } = usePlaceBet();
  const placing = placement.attempt?.status === "sending";
  // The slip as a bet: null while it can't be placed as it stands.
  const request = useMemo(
    () => placeRequestFrom({ selections, totals, stake, oddsPolicy }),
    [selections, totals, stake, oddsPolicy],
  );

  // Booking saves the slip slipcalc priced: its live picks, bet type and
  // system size. Null when it can't be booked (nothing live, a same-match
  // clash, too many legs or lines).
  const booking = useCreateBooking();
  const bookingRequest = useMemo(
    () => bookingRequestFrom({ selections, totals, stake }),
    [selections, totals, stake],
  );
  const signature = bookingRequest ? signatureOf(bookingRequest) : null;
  // A code — or a refusal — belongs to the slip it was asked for; once the
  // slip changes it no longer describes what is on screen.
  const bookedCode = signature ? booking.receiptFor(signature) : null;
  const bookError = signature ? booking.errorFor(signature) : null;
  const bookFailure = bookError ? bookingErrorMessage(bookError, "") : null;
  // Book bet keeps focus while it asks (aria-disabled, not disabled); once the
  // code arrives, focus moves to it so it is read out and can be copied.
  const bookedNow = useRef(false);
  const codePanel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (bookedCode && bookedNow.current) {
      bookedNow.current = false;
      codePanel.current?.focus();
    }
  }, [bookedCode]);
  const bookDisabled = !bookingRequest || booking.isPending || !!bookedCode;

  const conflicts = useMemo(
    () => new Set(totals.conflictEventIds),
    [totals.conflictEventIds],
  );
  const pending = useMemo(
    () => new Set(totals.pendingOddsChanges.map((s) => s.outcomeId)),
    [totals.pendingOddsChanges],
  );

  if (placement.receipt) {
    return (
      <div className="bg-ground flex w-full flex-col">
        <BetSlipHeader count={totals.count} onClose={onClose} />
        <BetPlacedConfirmation
          receipt={placement.receipt}
          onKeepSelections={dismissReceipt}
          onDone={() => {
            clear();
            onClose?.();
          }}
        />
      </div>
    );
  }

  return (
    <div className="bg-ground flex w-full flex-col">
      <BetSlipHeader count={totals.count} onClose={onClose} />

      {totals.count > 0 && (
        <BetModeTabs
          mode={totals.mode}
          systemAvailable={totals.systemAvailable}
          systemK={totals.systemK}
          liveCount={totals.liveCount}
        />
      )}

      <SlipAlerts
        totals={totals}
        rules={rules?.calc ?? null}
        rulesState={rulesState}
        onRetryRules={retryRules}
        // A refusal the player can act on carries the fix, rather than
        // leaving them to work out what would be accepted.
        fixes={{
          retry,
          deposit: () => router.push(routes.walletAction("deposit")),
          verify: () => openAuth("verify"),
          viewLimits: () => router.push(routes.responsibleGaming),
        }}
      />

      <BookingNotice
        priced={{
          mode: totals.mode,
          systemK: totals.systemK,
          liveCount: totals.liveCount,
        }}
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
                pending={pending.has(selection.outcomeId)}
              />
            ))}
          </div>

          <StakeInput
            totals={totals}
            quickStakes={rules?.quickStakes ?? []}
            balance={balance}
          />
          {rules ? (
            <>
              <TaxBreakdown totals={totals} rules={rules.calc} />
              <PayoutSummary totals={totals} rules={rules.calc} />
            </>
          ) : (
            rulesState === "loading" && (
              <p role="status" className="text-muted mx-4 mt-3 text-[11px]">
                {t.t("betSlip.rulesLoading")}
              </p>
            )
          )}

          <div className="px-4">
            <OddsPolicySetting value={oddsPolicy} onChange={setOddsPolicy} />
          </div>

          {isGuest ? (
            <>
              {/* Next to the button that caused it: on a phone the top of the
                  sheet is scrolled out of view by now. */}
              {bookFailure && (
                <div className="px-4 pb-2">
                  <BookingAlert
                    action={
                      bookFailure.fixStake
                        ? {
                            label: t.t("betSlip.setMax", {
                              amount: t.number(bookFailure.fixStake),
                            }),
                            onClick: () => setStake(bookFailure.fixStake!),
                          }
                        : undefined
                    }
                  >
                    {t.t(
                      bookFailure.key,
                      bookFailure.fixStake
                        ? { amount: t.money(bookFailure.fixStake) }
                        : bookFailure.values,
                    )}
                  </BookingAlert>
                </div>
              )}
              {/* Booking is the alternative to signing up on the spot — the slip
                  keeps its value either way. */}
              <div
                className={cn(
                  "grid gap-2 px-4 pt-1",
                  bookingCodes ? "grid-cols-2" : "grid-cols-1",
                )}
              >
                {bookingCodes && (
                  <button
                    type="button"
                    onClick={() => {
                      if (bookDisabled || !bookingRequest) return;
                      bookedNow.current = true;
                      booking.book(bookingRequest);
                    }}
                    // Off while the slip can't be booked, while asking, and
                    // once this slip has its code — announced as off, but
                    // still focusable, so a keyboard user keeps their place.
                    aria-disabled={bookDisabled}
                    aria-busy={booking.isPending}
                    className="bg-raised text-text font-body flex h-12 cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-bold aria-disabled:cursor-not-allowed aria-disabled:opacity-45"
                  >
                    {booking.isPending && (
                      <Loader2 size={16} className="animate-spin" aria-hidden />
                    )}
                    {bookedCode && <Check size={16} aria-hidden />}
                    {t.t(bookedCode ? "booking.booked" : "betSlip.bookBet")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openAuth("login")}
                  className="bg-accent text-on-accent font-body h-12 cursor-pointer rounded-md text-sm font-bold"
                >
                  {t.t("betSlip.loginToBet")}
                </button>
              </div>
              {bookingCodes && bookedCode && (
                <BookingCode ref={codePanel} receipt={bookedCode} />
              )}
              <div className="pb-2" />
            </>
          ) : (
            <PlaceBetButton
              action={cta.action}
              disabled={cta.disabled}
              totals={totals}
              pending={placing}
              onPlace={() => {
                if (request) place(request);
              }}
              onDeposit={() => router.push(routes.walletAction("deposit"))}
              // A dialog, not a navigation: the slip they just built is the
              // reason they are logging in.
              onLogin={() => openAuth("login")}
            />
          )}
        </>
      )}

      {/* Somewhere to redeem a code: a guest with an empty slip is often someone
          who was handed one. */}
      {bookingCodes && (isGuest || totals.count === 0) && <LoadBookingCode />}
    </div>
  );
}
