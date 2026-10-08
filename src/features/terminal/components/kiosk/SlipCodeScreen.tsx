"use client";

import { useEffect, useRef } from "react";
import { Dialog } from "radix-ui";
import { QrCode } from "@/components/ui/QrCode";
import { useCountdown } from "@/features/auth/hooks/use-countdown";
import { useValidUntil } from "@/features/bookings/hooks/use-valid-until";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { ShownCode } from "../../stores/kiosk.store";

/**
 * The slip code, over the whole kiosk (F8cc AC-1, C19 §4.2): the code in
 * large type as the counter types it (`4829 1735`), its QR, how long it is
 * valid (East Africa Time, D7), where to take it, and how long the screen
 * stays — `codeMs` from when the code arrived, then `onClose` as timed out.
 * Done (or Escape) closes it at once. It says nothing about money: the
 * counter prices the code when it sells it (C19 §4.3).
 *
 * The countdown is shown, not announced: a screen reader hears the code and
 * where to take it once, not every second.
 */
export function SlipCodeScreen({
  shown,
  codeMs,
  onClose,
}: {
  shown: ShownCode;
  codeMs: number;
  onClose: (how: { timedOut: boolean }) => void;
}) {
  const t = useTranslation();
  const validUntil = useValidUntil();
  const closesAt = shown.at + codeMs;
  const { remaining } = useCountdown(closesAt);

  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const timer = setTimeout(
      () => closeRef.current({ timedOut: true }),
      Math.max(0, closesAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [closesAt]);

  const { receipt } = shown;
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose({ timedOut: false });
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="bg-ground fixed inset-0 z-[60]" />
        <Dialog.Content
          data-testid="slip-code"
          onPointerDownOutside={(event) => event.preventDefault()}
          className="fixed inset-0 z-[61] flex flex-col items-center justify-center gap-4 overflow-y-auto p-6 text-center outline-none"
        >
          <Dialog.Title className="font-body text-xl font-bold">
            {t.t("terminal.code.title")}
          </Dialog.Title>
          <p className="font-display text-[44px] leading-none font-bold tracking-[0.08em] md:text-[64px]">
            {receipt.display}
          </p>
          <QrCode
            text={receipt.qr}
            label={t.t("terminal.code.qr", { code: receipt.display })}
            className="w-[200px] p-3 md:w-[260px]"
          />
          <Dialog.Description className="text-base font-semibold">
            {t.t("terminal.code.take")}
          </Dialog.Description>
          <p className="text-muted text-sm">{validUntil(receipt.expiresAt)}</p>
          <p className="text-muted text-sm">
            {t.t("terminal.code.clears", { seconds: remaining })}
          </p>
          <Dialog.Close asChild>
            <button
              type="button"
              autoFocus
              className="bg-accent text-on-accent font-body mt-2 h-12 w-full max-w-[320px] cursor-pointer rounded-md text-sm font-bold"
            >
              {t.t("betSlip.done")}
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
