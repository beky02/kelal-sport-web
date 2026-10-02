"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { SubmitButton } from "@/components/ui/Field";
import { cn } from "@/lib/utils/cn";
import { useCountdown } from "../../hooks/use-countdown";
import type { AuthErrorView } from "../../lib/errors";
import { AuthNotice } from "../AuthNotice";

const LENGTH = 6;

/**
 * An SMS code.
 *
 * Six boxes with one input behind them — the boxes are presentation, so paste,
 * autofill and the numeric keypad all keep working. The caret is shown by
 * outlining the next empty box. One step for every code the product asks for:
 * registration, a new device at login, a password reset, Fayda; the words
 * above the boxes say which.
 */
export function OtpStep({
  phoneMasked,
  body,
  pending = false,
  error = null,
  onFix,
  onSubmit,
  onChangeNumber,
  resendAt = null,
  onResend,
  submitLabel,
}: {
  phoneMasked: string;
  /** Replaces "Sent to {phone}" when the code needs explaining. */
  body?: React.ReactNode;
  pending?: boolean;
  error?: AuthErrorView | null;
  onFix?: () => void;
  onSubmit: (code: string) => void;
  onChangeNumber?: () => void;
  /** When a new code may be asked for (epoch ms, from `resend_after`). */
  resendAt?: number | null;
  onResend?: () => void;
  /** "Verify" unless the code is checked later ("Continue"). */
  submitLabel?: string;
}) {
  const t = useTranslation();
  const [code, setCode] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const resend = useCountdown(onResend ? resendAt : null);

  // The caret starts in the boxes. A refused code remounts this step (the
  // dialog keys it by attempt), so the boxes come back empty with the caret
  // in place.
  useEffect(() => {
    input.current?.focus();
  }, []);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!pending && code.length === LENGTH) onSubmit(code);
      }}
      className="flex flex-col gap-4"
    >
      <div>
        <h2 className="mb-1.5 text-2xl">{t.t("auth.otpTitle")}</h2>
        <div className="text-muted">
          {body ?? t.t("auth.otpSentTo", { phone: phoneMasked })}
        </div>
      </div>

      <label className="relative grid cursor-text grid-cols-6 gap-2">
        {Array.from({ length: LENGTH }, (_, index) => (
          <span
            key={index}
            aria-hidden
            className={cn(
              "font-display bg-surface grid h-[54px] place-items-center border text-xl",
              index === code.length ? "border-accent" : "border-transparent",
            )}
          >
            {code[index] ?? ""}
          </span>
        ))}
        <input
          ref={input}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={LENGTH}
          value={code}
          onChange={(event) =>
            setCode(event.target.value.replace(/\D/g, "").slice(0, LENGTH))
          }
          aria-label={t.t("auth.otpLabel")}
          className="absolute inset-0 w-full opacity-0"
        />
      </label>

      <AuthNotice error={error} onFix={onFix} />

      {(onResend || onChangeNumber) && (
        <div className="flex justify-between text-xs">
          {onResend ? (
            resend.elapsed ? (
              <button
                type="button"
                onClick={onResend}
                disabled={pending}
                className="text-accent cursor-pointer bg-transparent font-semibold disabled:cursor-not-allowed disabled:opacity-45"
              >
                {t.t("auth.sendCode")}
              </button>
            ) : (
              <span className="text-muted">
                {t.t("auth.resendIn", { seconds: resend.label })}
              </span>
            )
          ) : (
            <span />
          )}
          {onChangeNumber && (
            <button
              type="button"
              onClick={onChangeNumber}
              className="text-accent cursor-pointer bg-transparent font-semibold"
            >
              {t.t("auth.changeNumber")}
            </button>
          )}
        </div>
      )}

      <SubmitButton
        disabled={code.length < LENGTH || pending}
        aria-busy={pending || undefined}
      >
        {submitLabel ?? t.t("auth.verify")}
      </SubmitButton>
    </form>
  );
}
