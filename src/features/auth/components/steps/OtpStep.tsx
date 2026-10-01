"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { SubmitButton } from "@/components/ui/Field";
import { cn } from "@/lib/utils/cn";
import { useCountdown } from "../../hooks/use-countdown";

const LENGTH = 6;

/**
 * Step 2: the SMS code.
 *
 * Six boxes with one input behind them — the boxes are presentation, so paste,
 * autofill and the numeric keypad all keep working. The caret is shown by
 * outlining the next empty box.
 */
export function OtpStep({
  phoneMasked,
  onNext,
  onChangeNumber,
}: {
  phoneMasked: string;
  onNext: () => void;
  onChangeNumber: () => void;
}) {
  const t = useTranslation();
  const [code, setCode] = useState("");
  const resend = useCountdown(45, true);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onNext();
      }}
      className="flex flex-col gap-4"
    >
      <div>
        <h2 className="mb-1.5 text-2xl">{t.t("auth.otpTitle")}</h2>
        <div className="text-muted">
          {t.t("auth.otpSentTo", { phone: phoneMasked })}
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

      <div className="flex justify-between text-xs">
        <span className="text-muted">
          {resend.elapsed
            ? t.t("auth.sendCode")
            : t.t("auth.resendIn", { seconds: resend.label })}
        </span>
        <button
          type="button"
          onClick={onChangeNumber}
          className="text-accent cursor-pointer bg-transparent font-semibold"
        >
          {t.t("auth.changeNumber")}
        </button>
      </div>

      <SubmitButton disabled={code.length < LENGTH}>
        {t.t("auth.verify")}
      </SubmitButton>
    </form>
  );
}
