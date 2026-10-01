"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Field, PhoneInput, SubmitButton } from "@/components/ui/Field";

export function ForgotStep({
  onSent,
  onBackToLogin,
}: {
  onSent: () => void;
  onBackToLogin: () => void;
}) {
  const t = useTranslation();
  const [phone, setPhone] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSent();
      }}
      className="flex flex-col gap-4"
    >
      <div>
        <h2 className="mb-1.5 text-2xl">{t.t("auth.forgotTitle")}</h2>
        <div className="text-muted">{t.t("auth.forgotBody")}</div>
      </div>

      <Field label={t.t("auth.phone")}>
        {(props) => (
          <PhoneInput
            {...props}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="912 345 482"
          />
        )}
      </Field>

      <SubmitButton disabled={phone.trim() === ""}>
        {t.t("auth.sendCode")}
      </SubmitButton>

      <button
        type="button"
        onClick={onBackToLogin}
        className="text-accent cursor-pointer bg-transparent text-center font-semibold"
      >
        {t.t("auth.backToLogin")}
      </button>
    </form>
  );
}
