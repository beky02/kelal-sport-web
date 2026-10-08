"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import {
  AlertList,
  type SlipAlert,
} from "@/features/bet-slip/components/AlertList";
import { BookingCodeDialog } from "@/features/bet-slip/components/BookingCodeDialog";
import { useBetSlipStore } from "@/features/bet-slip/stores/bet-slip.store";
import { useCountdown } from "@/features/auth/hooks/use-countdown";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { useBookSlip } from "../../hooks/use-slip-code";
import { minutesLeft } from "../../lib/slip-code";
import { useKioskStore } from "../../stores/kiosk.store";
import type { SlipCodeRequest } from "../../types";

/**
 * Book bet at the foot of the kiosk's slip (F8cc): the slip on screen saved as
 * an 8-digit slip code the counter sells from (C19 §4.2), shown in the
 * player's booking-code dialog (the user's review) — the code, its barcode,
 * how long it lasts, and Done; a tap outside closes it too. Booked opens the
 * same code again; a changed slip books anew.
 *
 * Off while the slip can't be booked (`request` null: Book bet's rule), while
 * a code is on its way, and while the terminal waits out its limit — which it
 * says, counting down in minutes (decision 6). Under it, why the last Book bet
 * of this slip failed, with the fix where there is one: the server's stake as
 * a tap. A pick it refused is marked in the slip itself.
 */
export function BookBet(props: {
  request: SlipCodeRequest | null;
  booking: ReturnType<typeof useBookSlip>;
}) {
  const until = useKioskStore((s) => s.codesPausedUntil);
  // A new wait counts from its own start (the countdown reads its deadline
  // when it mounts).
  return <BookBetButton key={until ?? "none"} until={until} {...props} />;
}

function BookBetButton({
  until,
  request,
  booking,
}: {
  until: number | null;
  request: SlipCodeRequest | null;
  booking: ReturnType<typeof useBookSlip>;
}) {
  const t = useTranslation();
  const setStake = useBetSlipStore((s) => s.setStake);
  const { remaining, elapsed } = useCountdown(until);
  const waiting = until !== null && !elapsed;
  const receipt = booking.receiptFor(request);
  // Asked for by this slip's button: the slip is mounted twice below `xl`
  // (its hidden column and the sheet), and only the one tapped opens the
  // code — once it has arrived, and until it is closed.
  const [asked, setAsked] = useState(false);
  const off = !request || booking.sending || (!receipt && waiting);

  const alerts: SlipAlert[] = [];
  if (waiting && !receipt) {
    alerts.push({
      id: "paused",
      tone: "warn",
      title: t.t("terminal.code.paused", { minutes: minutesLeft(remaining) }),
    });
  } else if (!receipt) {
    const refusal = booking.refusalFor(request);
    if (refusal?.kind === "paused") {
      // A wait the API gave no length for: said, without holding Book bet.
      if (refusal.retryAfter === null || refusal.retryAfter <= 0) {
        alerts.push({
          id: "paused",
          tone: "warn",
          title: t.t("terminal.code.pausedLater"),
        });
      }
    } else if (refusal?.kind === "stake") {
      alerts.push({
        id: "stake",
        tone: "error",
        title: t.t(refusal.key, { amount: t.money(refusal.amount) }),
        action: {
          label: t.t("betSlip.setMax", { amount: t.number(refusal.amount) }),
          onClick: () => setStake(refusal.amount),
        },
      });
    } else if (refusal?.kind === "status" || refusal?.kind === "message") {
      alerts.push({ id: "refused", tone: "error", title: t.t(refusal.key) });
    }
  }

  return (
    <>
      <div className="px-4 pt-3">
        <button
          type="button"
          onClick={() => {
            if (off || !request) return;
            setAsked(true);
            if (!receipt) booking.book(request);
          }}
          aria-disabled={off}
          aria-busy={booking.sending}
          className="bg-accent text-on-accent font-body flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-bold aria-disabled:cursor-not-allowed aria-disabled:opacity-45"
        >
          {booking.sending && (
            <Loader2 size={16} className="animate-spin" aria-hidden />
          )}
          {receipt && <Check size={16} aria-hidden />}
          {t.t(receipt ? "booking.booked" : "betSlip.bookBet")}
        </button>
      </div>
      {alerts.length > 0 && (
        <div className="pt-2">
          <AlertList alerts={alerts} />
        </div>
      )}
      {/* No Copy or Share: a shop PC is no one's to copy to or share from.
          The code as the counter reads it (`display`); its barcode is of the
          same digits. */}
      {receipt && (
        <BookingCodeDialog
          receipt={{ code: receipt.display, expiresAt: receipt.expiresAt }}
          open={asked}
          onClose={() => setAsked(false)}
        />
      )}
    </>
  );
}
