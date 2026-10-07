"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Loader2, Ticket } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { BetSelectionRow } from "@/features/bet-slip/components/BetSelectionRow";
import { BetSlipHeader } from "@/features/bet-slip/components/BetSlipHeader";
import { EmptySlip } from "@/features/bet-slip/components/EmptySlip";
import {
  BookingAlert,
  LoadBookingCode,
} from "@/features/bet-slip/components/BookingCode";
import { BookingCodeDialog } from "@/features/bet-slip/components/BookingCodeDialog";
import {
  signatureOf,
  useCreateBooking,
} from "@/features/bookings/hooks/use-bookings";
import { bookingErrorMessage } from "@/features/bookings/lib/errors";
import { bookingRequestFrom } from "@/features/bookings/lib/request";
import { BookingNotice } from "@/features/bookings/components/BookingNotice";
import { calculateBetSlip } from "@/features/bet-slip/lib/calculate";
import { useBetSlipStore } from "@/features/bet-slip/stores/bet-slip.store";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useTerminalConfig } from "../../hooks/use-kiosk";

/**
 * The kiosk's slip (F8ca), from the player's slip parts: its header with
 * Clear all, its empty state, and a row per pick (match, market, pick, the
 * odds when tapped; two picks of one match marked, by the slip's own rule),
 * and the player's Load booking code with its notice where the tenant has
 * codes. No stake, figure or button to bet yet: F8cb prices it with the
 * shop's rule set, F8cc turns it into a code for the counter. The store is
 * the player's slip store.
 */
export function KioskSlip({ onClose }: { onClose?: () => void }) {
  const selections = useBetSlipStore((s) => s.selections);
  const mode = useBetSlipStore((s) => s.mode);
  const systemK = useBetSlipStore((s) => s.systemK);
  const bookingCodes = useTerminalConfig().data?.bookingCodes ?? false;
  // The slip's own rules without a rule set (`calculateBetSlip`): no figure —
  // only which picks clash in the slip's mode, and the bet it would book.
  const totals = useMemo(
    () =>
      calculateBetSlip({
        selections,
        mode,
        stake: "",
        systemK,
        rules: null,
        balance: null,
        oddsPolicy: "any",
      }),
    [selections, mode, systemK],
  );
  const conflicts = useMemo(
    () => new Set(totals.conflictEventIds),
    [totals.conflictEventIds],
  );
  const book = useBookBet(totals);

  return (
    // The player's slip body (`BetSlip`), so its tiles and rows read the same.
    <div className="bg-ground flex w-full flex-col pb-3">
      <BetSlipHeader count={selections.length} onClose={onClose} />
      {/* No priced bet on the kiosk before F8cb, so no note about the code's
          system sizes against it (review Q3). */}
      <BookingNotice priced={null} />
      {selections.length === 0 ? (
        <EmptySlip />
      ) : (
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
      )}
      {bookingCodes && selections.length > 0 && <BookBet {...book} />}
      {bookingCodes && <LoadBookingCode />}
    </div>
  );
}

/**
 * Book bet, as the player's guest slip has it (the user's third review): the
 * picks saved as a code the customer takes to the counter, shown in a dialog
 * (`BookedCode`) — no stake, since
 * the kiosk prices nothing before F8cb. One `Idempotency-Key` per slip, reused
 * on a retry (`useCreateBooking`); the code belongs to the slip it was asked
 * for, and goes once the slip changes.
 */
function useBookBet(totals: ReturnType<typeof calculateBetSlip>) {
  const selections = useBetSlipStore((s) => s.selections);
  const booking = useCreateBooking();
  const request = useMemo(
    () => bookingRequestFrom({ selections, totals, stake: "" }),
    [selections, totals],
  );
  const signature = request ? signatureOf(request) : null;
  const receipt = signature ? booking.receiptFor(signature) : null;
  const error = signature ? booking.errorFor(signature) : null;
  return {
    receipt,
    failure: error ? bookingErrorMessage(error, "") : null,
    pending: booking.isPending,
    onBook: request && !receipt ? () => booking.book(request) : null,
  };
}

function BookBet({
  receipt,
  failure,
  pending,
  onBook,
}: ReturnType<typeof useBookBet>) {
  const t = useTranslation();
  // Asked for by this slip's button: the slip is mounted twice below `xl`
  // (its hidden column and the sheet), and only the one tapped opens the
  // code — once it has arrived, and until Done.
  const [asked, setAsked] = useState(false);
  const showing = asked && receipt !== null;
  const off = pending || (!onBook && !receipt);

  return (
    <>
      <div className="px-4 pt-3">
        <button
          type="button"
          onClick={() => {
            if (off) return;
            setAsked(true);
            if (!receipt) onBook?.();
          }}
          aria-disabled={off}
          aria-busy={pending}
          className="bg-accent text-on-accent font-body flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-bold aria-disabled:cursor-not-allowed aria-disabled:opacity-45"
        >
          {pending && (
            <Loader2 size={16} className="animate-spin" aria-hidden />
          )}
          {receipt && <Check size={16} aria-hidden />}
          {t.t(receipt ? "booking.booked" : "betSlip.bookBet")}
        </button>
      </div>
      {failure && (
        <div className="px-4 pt-2">
          <BookingAlert>{t.t(failure.key, failure.values)}</BookingAlert>
        </div>
      )}
      {/* No Copy or Share: a shop PC is no one's to copy to or share from. */}
      {receipt && (
        <BookingCodeDialog
          receipt={receipt}
          open={showing}
          onClose={() => setAsked(false)}
        />
      )}
    </>
  );
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
