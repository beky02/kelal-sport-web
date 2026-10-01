"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { MessageKey } from "@/lib/i18n";
import { Switch } from "@/components/ui/Switch";
import { routes } from "@/config/routes";
import { ApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils/cn";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { useBetSlip } from "../hooks/use-bet-slip";
import { usePlaceBet } from "../hooks/use-place-bet";
import { useBetSlipStore } from "../stores/bet-slip.store";
import type { BetReceipt } from "../api/place-bet";
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
import { PayoutSummary } from "./PayoutSummary";
import { PlaceBetButton } from "./PlaceBetButton";
import { SlipAlerts } from "./SlipAlerts";
import { StakeInput } from "./StakeInput";
import { TaxBreakdown } from "./TaxBreakdown";

/**
 * What a refusal from the engine means, by its Problem `code` — never by its
 * title, which is display text in whatever language the API chose.
 */
const PLACE_ERROR_BODY: Record<string, MessageKey> = {
  BET_RELATED_SELECTIONS: "betSlip.alerts.conflictBody",
  BET_MARKET_SUSPENDED: "betSlip.alerts.suspendedBody",
  BET_EVENT_STARTED: "betSlip.alerts.suspendedBody",
  VALIDATION_FAILED: "betSlip.errors.cannotPriceBody",
  RULES_UNAVAILABLE: "betSlip.rulesFailed",
};

/**
 * The bet slip.
 *
 * Same component in the desktop aside and the mobile sheet — only `onClose`
 * differs, because only the sheet can be dismissed. Every number on screen comes
 * from `useBetSlip`, and the confirmation comes from the engine's receipt.
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
    rulesState,
    retryRules,
    bookingCodes,
  } = useBetSlip();
  const selections = useBetSlipStore((s) => s.selections);
  const clear = useBetSlipStore((s) => s.clear);
  const acceptAnyChange = useBetSlipStore((s) => s.acceptAnyChange);
  const setAcceptAnyChange = useBetSlipStore((s) => s.setAcceptAnyChange);
  const setStake = useBetSlipStore((s) => s.setStake);
  const stake = useBetSlipStore((s) => s.stake);

  const [receipt, setReceipt] = useState<BetReceipt | null>(null);
  const place = usePlaceBet(setReceipt);

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

  // The engine refused the stake and said what it would take, so the alert
  // can offer to set it rather than just reporting the problem.
  const rejection = place.error instanceof ApiError ? place.error : null;
  const stakeFix =
    rejection &&
    (rejection.code === "BET_STAKE_TOO_HIGH" ||
      rejection.code === "BET_STAKE_TOO_LOW")
      ? (rejection.errors.find((e) => e.field === "stake")?.limit ?? null)
      : null;

  const conflicts = useMemo(
    () => new Set(totals.conflictEventIds),
    [totals.conflictEventIds],
  );
  const pending = useMemo(
    () => new Set(totals.pendingOddsChanges.map((s) => s.outcomeId)),
    [totals.pendingOddsChanges],
  );

  if (receipt) {
    return (
      <div className="bg-ground flex w-full flex-col">
        <BetSlipHeader count={totals.count} onClose={onClose} />
        <BetPlacedConfirmation
          receipt={receipt}
          onKeepSelections={() => setReceipt(null)}
          onDone={() => {
            setReceipt(null);
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
      />

      <BookingNotice />

      {place.isError && (
        <div
          role="alert"
          className="bg-loss-bg mx-3 mb-2.5 flex items-center gap-2.5 rounded-md p-3"
        >
          <CircleAlert
            size={17}
            strokeWidth={1.5}
            aria-hidden
            className="text-loss shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="font-bold">{t.t("betSlip.placeFailed")}</div>
            <div className="text-muted text-xs">
              {stakeFix
                ? t.t(
                    rejection?.code === "BET_STAKE_TOO_LOW"
                      ? "betSlip.errors.stakeTooLowBody"
                      : "betSlip.errors.stakeTooHighBody",
                    { amount: t.money(stakeFix) },
                  )
                : t.t(
                    PLACE_ERROR_BODY[rejection?.code ?? ""] ??
                      "betSlip.placeFailedBody",
                  )}
            </div>
          </div>
          {/* A rejection the user can act on carries the fix, rather than
              leaving them to work out what number would be accepted. */}
          {stakeFix && (
            <button
              type="button"
              onClick={() => {
                setStake(stakeFix);
                place.reset();
              }}
              className="bg-raised text-text font-body min-h-11 shrink-0 cursor-pointer rounded-lg px-3 text-xs font-bold"
            >
              {t.t("betSlip.setMax", { amount: t.number(stakeFix) })}
            </button>
          )}
        </div>
      )}

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
            <Switch
              checked={acceptAnyChange}
              onChange={setAcceptAnyChange}
              label={t.t("betSlip.acceptAnyChange")}
            />
          </div>

          {isGuest ? (
            <>
              {/* Next to the button that caused it: on a phone the top of the
                  sheet is scrolled out of view by now. */}
              {bookFailure && (
                <div className="px-4 pb-2">
                  <BookingAlert>
                    {t.t(bookFailure.key, bookFailure.values)}
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
                    onClick={() =>
                      bookingRequest && booking.book(bookingRequest)
                    }
                    // Off while the slip can't be booked, while asking, and
                    // once this slip has its code.
                    disabled={
                      !bookingRequest || booking.isPending || !!bookedCode
                    }
                    className="bg-raised text-text font-body h-12 cursor-pointer rounded-md text-sm font-bold disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {t.t("betSlip.bookBet")}
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
                <BookingCode receipt={bookedCode} />
              )}
              <div className="pb-2" />
            </>
          ) : (
            <PlaceBetButton
              action={cta.action}
              disabled={cta.disabled}
              totals={totals}
              pending={place.isPending}
              onPlace={() => place.mutate()}
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
