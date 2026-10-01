"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Barcode } from "@/components/ui/Barcode";

/**
 * A slip saved without placing it.
 *
 * The path that matters for a guest, and for anyone without a funded account: the
 * code can be placed later, sent to someone, or read out at an agent shop. Big
 * and tracked out because it gets read aloud and typed in.
 */
export function BookingCode({ code }: { code: string }) {
  const t = useTranslation();
  const [copied, setCopied] = useState(false);

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
    <div className="bg-surface mx-4 mt-3.5 flex flex-col gap-2.5 rounded-lg p-3.5">
      <div className="text-muted flex items-baseline justify-between gap-2 text-[11px]">
        <span>{t.t("betSlip.bookingCode")}</span>
        <span>{t.t("betSlip.validUntilKickoff")}</span>
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
        <button
          type="button"
          style={{ background: "#229ed9" }}
          className="font-body flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md text-[13px] font-bold text-white"
        >
          <Send size={15} strokeWidth={1.5} aria-hidden />
          {t.t("betSlip.shareTelegram")}
        </button>
      </div>

      <p className="text-muted text-[11px]">{t.t("betSlip.bookHint")}</p>
    </div>
  );
}

/** Takes a code someone was given and loads it back into the slip. */
export function LoadBookingCode() {
  const t = useTranslation();
  const [code, setCode] = useState("");

  return (
    <div className="flex flex-col gap-1.5 px-4 pt-3.5 pb-5">
      <label htmlFor="load-code" className="text-muted text-[11px]">
        {t.t("betSlip.loadCode")}
      </label>
      <div className="flex gap-1.5">
        <input
          id="load-code"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder={t.t("betSlip.loadCodePlaceholder")}
          className="bg-raised text-text font-body h-11 min-w-0 flex-1 rounded-md border-0 px-3 text-sm font-semibold tracking-[0.08em] uppercase outline-none"
        />
        <button
          type="button"
          disabled={code.trim().length === 0}
          className="bg-raised text-text font-body h-11 cursor-pointer rounded-md px-4 text-[13px] font-bold disabled:opacity-45"
        >
          {t.t("betSlip.load")}
        </button>
      </div>
    </div>
  );
}
