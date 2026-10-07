"use client";

import { useId, useState } from "react";
import { CircleAlert, Loader2, Send } from "lucide-react";
import { useBetSlipStore } from "../stores/bet-slip.store";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useLoadBooking } from "@/features/bookings/hooks/use-bookings";
import { normaliseBookingCode } from "@/features/bookings/lib/code";
import { bookingErrorMessage } from "@/features/bookings/lib/errors";
import type { BookingReceipt } from "@/features/bookings/types";
import { telegramShareUrl } from "@/lib/share";

/**
 * What a player can do with a booked code, under it in its dialog
 * (`BookingCodeDialog`): copy it, or send it on Telegram — to place later, to
 * someone, or to read out at an agent shop.
 */
export function BookingCodeActions({ receipt }: { receipt: BookingReceipt }) {
  const t = useTranslation();
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
    <>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={copy}
          className="bg-raised text-text font-body h-11 cursor-pointer rounded-md text-[13px] font-bold"
        >
          {t.t(copied ? "betSlip.copied" : "betSlip.copyCode")}
        </button>
        <a
          href={telegramShareUrl(
            receipt.shareUrl,
            t.t("booking.shareText", { code }),
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-telegram font-body flex h-11 items-center justify-center gap-2 rounded-md px-2 text-center text-[13px] leading-tight font-bold text-white"
        >
          <Send size={15} strokeWidth={1.5} aria-hidden />
          {t.t("betSlip.shareTelegram")}
        </a>
      </div>
      <p className="text-muted text-[11px]">{t.t("betSlip.bookHint")}</p>
    </>
  );
}

/** A refusal or failure, in the slip's alert style, with its fix if any. */
export function BookingAlert({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: { label: string; onClick: () => void };
}) {
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
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="bg-raised text-text font-body min-h-11 shrink-0 cursor-pointer rounded-lg px-3 text-xs font-bold"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/** Takes a code someone was given and loads it back into the slip. */
export function LoadBookingCode() {
  const t = useTranslation();
  const [raw, setRaw] = useState("");
  const [invalid, setInvalid] = useState(false);
  const load = useLoadBooking(() => setRaw(""));
  const inSlip = useBetSlipStore((s) => s.selections.length);
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
        setInvalid(raw.trim() !== "" && code === null);
        // Checked before any call: only a well-formed code reaches the API.
        if (raw.trim() === "" || load.isPending) return;
        if (code) load.mutate(code);
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
          // Announced as off, never disabled: the input is cleared after a
          // load, and a disabled button would drop the focus it holds.
          aria-disabled={load.isPending || raw.trim() === ""}
          aria-busy={load.isPending}
          className="bg-raised text-text font-body flex h-11 cursor-pointer items-center gap-1.5 rounded-md px-4 text-[13px] font-bold aria-disabled:opacity-45"
        >
          {load.isPending && (
            <Loader2 size={14} className="animate-spin" aria-hidden />
          )}
          {t.t("betSlip.load")}
        </button>
      </div>
      {inSlip > 0 && (
        <p className="text-muted text-[11px]">{t.t("booking.replacesSlip")}</p>
      )}
      {invalid && <BookingAlert>{t.t("booking.invalidCode")}</BookingAlert>}
      {failure && (
        <BookingAlert>{t.t(failure.key, failure.values)}</BookingAlert>
      )}
    </form>
  );
}
