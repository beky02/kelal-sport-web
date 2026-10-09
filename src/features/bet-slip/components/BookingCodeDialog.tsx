"use client";

import { Dialog } from "radix-ui";
import { Barcode } from "@/components/ui/Barcode";
import { useValidUntil } from "@/features/bookings/hooks/use-valid-until";
import type { BookingReceipt } from "@/features/bookings/types";
import { useTranslation } from "@/lib/i18n/use-translation";

/**
 * A booked code in a dialog over the slip, as most betting apps show it (the
 * user's fourth review), so it never sits in the list of picks: the code
 * large, its barcode for a scanner, how long it lasts, then whatever the site
 * offers to do with it (`children`: the player's Copy and Share; nothing on a
 * shop kiosk) and Done. Above the slip's phone sheet (z-50). The shop kiosk
 * shows its slip code in it too (F8cc, the user's review): any code and its
 * expiry.
 */
export function BookingCodeDialog({
  receipt,
  open,
  onClose,
  children,
}: {
  receipt: Pick<BookingReceipt, "code" | "expiresAt">;
  open: boolean;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  const t = useTranslation();
  const validUntil = useValidUntil();
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[55] bg-black/60" />
        <Dialog.Content
          data-testid="booking-code"
          aria-describedby={undefined}
          className="bg-surface border-border fixed top-1/2 left-1/2 z-[56] flex w-[400px] max-w-[calc(100vw-2.5rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-lg border p-6 outline-none"
        >
          <div className="text-muted flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
            <Dialog.Title className="text-text text-lg">
              {t.t("betSlip.bookingCode")}
            </Dialog.Title>
            <span>{validUntil(receipt.expiresAt)}</span>
          </div>
          <div className="font-display text-4xl leading-none tracking-[0.14em]">
            {receipt.code}
          </div>
          <Barcode code={receipt.code} label={t.t("betSlip.bookingCode")} />
          {children}
          <Dialog.Close asChild>
            <button
              type="button"
              className="bg-accent text-on-accent font-body mt-1 h-12 cursor-pointer rounded-md text-sm font-bold"
            >
              {t.t("betSlip.done")}
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
