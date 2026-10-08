"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { routes } from "@/config/routes";
import { cn } from "@/lib/utils/cn";
import { useSession } from "@/features/auth/hooks/use-session";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { useBetSlip } from "../hooks/use-bet-slip";
import { usePlaceBet } from "../hooks/use-place-bet";
import type { CtaAction } from "../lib/calculate";
import { placeRequestFrom, samePrices, slipIsThatBet } from "../lib/placement";
import { ownPlacement, useBetSlipStore } from "../stores/bet-slip.store";
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
import {
  BookingAlert,
  BookingCodeActions,
  LoadBookingCode,
} from "./BookingCode";
import { BookingCodeDialog } from "./BookingCodeDialog";
import { EmptySlip } from "./EmptySlip";
import { OddsPolicySetting } from "./OddsPolicySetting";
import { PayoutSummary } from "./PayoutSummary";
import { PlaceBetButton } from "./PlaceBetButton";
import { SlipAlerts } from "./SlipAlerts";
import { StakeInput } from "./StakeInput";
import { SlipSummary } from "./SlipSummary";

/**
 * The bet slip.
 *
 * Same component in the desktop aside and the mobile sheet — only `onClose`
 * differs, because only the sheet can be dismissed. Every number on screen comes
 * from `useBetSlip`, and the confirmation is the engine's ticket. Placing —
 * the bet on its way, an unconfirmed one, a refusal, the ticket — lives in the
 * slip store, so both mounted slips show the same state and a closed sheet
 * loses none of it. It is the signed-in player's alone: a guest sees none of
 * it, and it is dropped when someone else signs in.
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

  const playerId = useSession().player?.id ?? null;
  const stored = useBetSlipStore((s) => s.placement);
  const forgetPlacement = useBetSlipStore((s) => s.forgetPlacement);
  const dismissReceipt = useBetSlipStore((s) => s.dismissReceipt);
  // Another player signed in on this device: nothing of the last one's
  // ticket, refusal or unconfirmed bet stays (docs/design/09).
  useEffect(() => {
    if (playerId && stored.owner && stored.owner !== playerId) {
      forgetPlacement();
    }
  }, [playerId, stored.owner, forgetPlacement]);
  const placement = ownPlacement(stored, playerId);
  const { place, retry, placeAsNew } = usePlaceBet(playerId);
  const placing = placement.sending !== null;
  const unconfirmed = placement.unconfirmed;
  // The slip as a bet, with what it charges: null while it can't be placed
  // as it stands.
  const intent = useMemo(() => {
    const request = placeRequestFrom({ selections, totals, stake, oddsPolicy });
    return request && totals.quote
      ? {
          request,
          totalStake: totals.quote.totalStake,
          lines: totals.quote.lines,
        }
      : null;
  }, [selections, totals, stake, oddsPolicy]);
  // The main button acts on the slip shown above it. While a bet is
  // unconfirmed that is Try again only as long as the slip still is that bet;
  // once it is another, the button places it — as a new bet, the player's
  // explicit choice — and Try again stays in the alert, which names the bet.
  const thatBet =
    unconfirmed !== null &&
    slipIsThatBet(intent?.request ?? null, unconfirmed, placement.stale);
  const action: CtaAction = !unconfirmed
    ? cta.action
    : thatBet
      ? "retry"
      : cta.action === "place"
        ? "place-new"
        : cta.action;
  const amount =
    action === "retry"
      ? (unconfirmed?.totalStake ?? null)
      : action === "place" || action === "place-new"
        ? (totals.quote?.totalStake ?? null)
        : null;
  // The alert says which bet Try again sends whenever the slip doesn't show
  // exactly it — its prices and its odds setting too — and warns of two
  // bets once the main button would place the slip as another.
  const exactly =
    intent !== null &&
    unconfirmed !== null &&
    samePrices(intent.request, unconfirmed.request) &&
    intent.request.oddsPolicy === unconfirmed.request.oddsPolicy;
  const unconfirmedNote =
    unconfirmed === null || exactly
      ? null
      : !thatBet && totals.count > 0
        ? "changed"
        : "asItWas";

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
  // Book bet keeps focus while it asks (aria-disabled, not disabled). The code
  // opens in a dialog once it arrives, for the slip whose button asked — the
  // slip is mounted twice below 1280 px — and "Booked" opens it again.
  const [codeAsked, setCodeAsked] = useState(false);
  const showingCode = codeAsked && bookedCode !== null;
  const bookDisabled = !bookedCode && (!bookingRequest || booking.isPending);

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
        balance={balance}
        rules={rules?.calc ?? null}
        rulesState={rulesState}
        onRetryRules={retryRules}
        placement={placement}
        unconfirmedNote={unconfirmedNote}
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
              <SlipSummary totals={totals} />
              <PayoutSummary totals={totals} rules={rules.calc} />
            </>
          ) : (
            rulesState === "loading" && (
              <p role="status" className="text-muted mx-4 mt-3 text-[11px]">
                {t.t("betSlip.rulesLoading")}
              </p>
            )
          )}

          <div className="mt-2 px-4">
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
                      if (bookDisabled) return;
                      setCodeAsked(true);
                      if (!bookedCode && bookingRequest) {
                        booking.book(bookingRequest);
                      }
                    }}
                    // Off while the slip can't be booked and while asking —
                    // announced as off, but still focusable, so a keyboard
                    // user keeps their place. Once booked, it shows the code.
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
                <BookingCodeDialog
                  receipt={bookedCode}
                  open={showingCode}
                  onClose={() => setCodeAsked(false)}
                >
                  <BookingCodeActions receipt={bookedCode} />
                </BookingCodeDialog>
              )}
              <div className="pb-2" />
            </>
          ) : (
            <PlaceBetButton
              action={action}
              disabled={action === "retry" ? false : cta.disabled}
              amount={amount}
              totals={totals}
              pending={placing}
              onPlace={() => {
                if (intent) place(intent);
              }}
              onPlaceNew={() => {
                if (intent) placeAsNew(intent);
              }}
              onRetry={retry}
              onDeposit={() => router.push(routes.walletAction("deposit"))}
              // A dialog, not a navigation: the slip they just built is the
              // reason they are logging in.
              onLogin={() => openAuth("login")}
            />
          )}
        </>
      )}

      {/* Somewhere to redeem a code: an empty slip is often someone who was
          handed one. A code replaces the slip, so it goes once there is a pick
          (the user's review, 2026-10-08); `/b/{code}` still replaces one. */}
      {bookingCodes && totals.count === 0 && <LoadBookingCode />}
    </div>
  );
}
