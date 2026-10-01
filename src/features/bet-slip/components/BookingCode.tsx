"use client";

import { useId, useState } from "react";
import { CircleAlert, Send } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Barcode } from "@/components/ui/Barcode";
import { useLoadBooking } from "@/features/bookings/hooks/use-bookings";
import { useValidUntil } from "@/features/bookings/hooks/use-valid-until";
import { normaliseBookingCode } from "@/features/bookings/lib/code";
import { bookingErrorMessage } from "@/features/bookings/lib/errors";
import type { BookingReceipt } from "@/features/bookings/types";

/** Telegram's share sheet on the booking's own link (D7: one link set). */
const telegramShare = (url: string, text: string) =>
  `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;

/**
 * A slip saved without placing it, under the code the server issued.
 *
 * The path that matters for a guest, and for anyone without a funded account: the
 * code can be placed later, sent to someone, or read out at an agent shop. Big
 * and tracked out because it gets read aloud and typed in.
 */
export function BookingCode({ receipt }: { receipt: BookingReceipt }) {
  const t = useTranslation();
  const validUntil = useValidUntil();
  const [copied, setCopied] = useState(false);
  const { code } = receipt;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the code is on screen to read either way.
    }
  };

  return (
    <div
      data-testid="booking-code"
      className="bg-surface mx-4 mt-3.5 flex flex-col gap-2.5 rounded-lg p-3.5"
    >
      <div className="text-muted flex flex-wrap items-baseline justify-between gap-x-2 text-[11px]">
        <span>{t.t("betSlip.bookingCode")}</span>
        <span>{validUntil(receipt.expiresAt)}</span>
      </div>

      <div className="font-display text-3xl leading-none tracking-[0.14em]">
        {code}
      </div>

      <Barcode
        code={code}
        barCount={58}
        seed={7}
        label={t.t("betSlip.bookingCode")}
      />

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={copy}
          className="bg-raised text-text font-body h-11 cursor-pointer rounded-md text-[13px] font-bold"
        >
          {t.t(copied ? "betSlip.copied" : "betSlip.copyCode")}
        </button>
        <a
          href={telegramShare(
            receipt.shareUrl,
            t.t("booking.shareText", { code }),
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-telegram font-body flex h-11 items-center justify-center gap-2 rounded-md text-[13px] font-bold text-white"
        >
          <Send size={15} strokeWidth={1.5} aria-hidden />
          {t.t("betSlip.shareTelegram")}
        </a>
      </div>

      <p className="text-muted text-[11px]">{t.t("betSlip.bookHint")}</p>
    </div>
  );
}

/** A refusal or failure, in the slip's alert style. */
export function BookingAlert({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="bg-loss-bg flex items-center gap-2.5 rounded-md p-3"
    >
      <CircleAlert
        size={17}
        strokeWidth={1.5}
        aria-hidden
        className="text-loss shrink-0"
      />
      <div className="min-w-0 flex-1 text-xs font-semibold">{children}</div>
    </div>
  );
}

/** Takes a code someone was given and loads it back into the slip. */
export function LoadBookingCode() {
  const t = useTranslation();
  const [raw, setRaw] = useState("");
  const [invalid, setInvalid] = useState(false);
  const load = useLoadBooking(() => setRaw(""));
  // Below 1280 px the slip is in the DOM twice (the hidden aside and the
  // sheet), so fixed IDs would tie the label to the hidden input.
  const inputId = useId();

  const failure =
    load.isError && load.variables
      ? bookingErrorMessage(load.error, load.variables)
      : null;

  return (
    <form
      className="flex flex-col gap-1.5 px-4 pt-3.5 pb-5"
      onSubmit={(event) => {
        event.preventDefault();
        const code = normaliseBookingCode(raw);
        setInvalid(code === null);
        // Checked before any call: only a well-formed code reaches the API.
        if (code && !load.isPending) load.mutate(code);
      }}
    >
      <label htmlFor={inputId} className="text-muted text-[11px]">
        {t.t("betSlip.loadCode")}
      </label>
      <div className="flex gap-1.5">
        <input
          id={inputId}
          value={raw}
          onChange={(event) => {
            setRaw(event.target.value.toUpperCase());
            setInvalid(false);
          }}
          placeholder={t.t("betSlip.loadCodePlaceholder")}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={invalid}
          // Tracked out for the Latin code being typed; the placeholder may be
          // Amharic, which takes no letter-spacing.
          className="bg-raised text-text font-body focus-visible:outline-accent h-11 min-w-0 flex-1 rounded-md border-0 px-3 text-sm font-semibold tracking-[0.08em] placeholder:tracking-normal focus-visible:outline-2"
        />
        <button
          type="submit"
          disabled={load.isPending || raw.trim() === ""}
          className="bg-raised text-text font-body h-11 cursor-pointer rounded-md px-4 text-[13px] font-bold disabled:opacity-45"
        >
          {t.t("betSlip.load")}
        </button>
      </div>
      {invalid && <BookingAlert>{t.t("booking.invalidCode")}</BookingAlert>}
      {failure && (
        <BookingAlert>{t.t(failure.key, failure.values)}</BookingAlert>
      )}
    </form>
  );
}
