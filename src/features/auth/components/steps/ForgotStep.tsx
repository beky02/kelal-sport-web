"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Field, PhoneInput, SubmitButton } from "@/components/ui/Field";
import type { AuthErrorView } from "../../lib/errors";
import { toE164 } from "../../lib/phone";
import { AuthNotice } from "../AuthNotice";

/** A forgotten password's first step: the phone the code goes to. */
export function ForgotStep({
  initialPhone = "",
  pending,
  error,
  onFix,
  onSubmit,
  onBackToLogin,
}: {
  initialPhone?: string;
  pending: boolean;
  error: AuthErrorView | null;
  onFix: () => void;
  onSubmit: (phone: string) => void;
  onBackToLogin: (phone: string) => void;
}) {
  const t = useTranslation();
  const [phone, setPhone] = useState(initialPhone);
  const [touched, setTouched] = useState(false);

  const valid = toE164(phone) !== null;
  const apiField = error?.fields?.phone;
  const fieldError =
    apiField !== undefined
      ? (apiField ?? t.t("auth.phoneInvalid"))
      : touched && phone.trim() !== "" && !valid
        ? t.t("auth.phoneInvalid")
        : undefined;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!pending && valid) onSubmit(phone.trim());
      }}
      className="flex flex-col gap-4"
      noValidate
    >
      <div>
        <h2 className="mb-1.5 text-2xl">{t.t("auth.forgotTitle")}</h2>
        <div className="text-muted">{t.t("auth.forgotBody")}</div>
      </div>

      <Field label={t.t("auth.phone")} error={fieldError}>
        {(props) => (
          <PhoneInput
            {...props}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="912 345 482"
          />
        )}
      </Field>

      <AuthNotice error={error} onFix={onFix} />

      <SubmitButton
        disabled={!valid || pending}
        aria-busy={pending || undefined}
      >
        {t.t("auth.sendCode")}
      </SubmitButton>

      <button
        type="button"
        onClick={() => onBackToLogin(phone.trim())}
        className="text-accent cursor-pointer bg-transparent text-center font-semibold"
      >
        {t.t("auth.backToLogin")}
      </button>
    </form>
  );
}
