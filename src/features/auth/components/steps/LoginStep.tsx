"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n/use-translation";
import {
  Field,
  OrDivider,
  PasswordInput,
  PhoneInput,
  SubmitButton,
  TelegramButton,
} from "@/components/ui/Field";
import type { AuthErrorView } from "../../lib/errors";
import { AuthNotice } from "../AuthNotice";

export function LoginStep({
  initialPhone = "",
  pending,
  error,
  onFix,
  onSubmit,
  onForgot,
  onRegister,
}: {
  initialPhone?: string;
  pending: boolean;
  error: AuthErrorView | null;
  onFix: () => void;
  onSubmit: (form: { phone: string; password: string }) => void;
  onForgot: () => void;
  onRegister: () => void;
}) {
  const t = useTranslation();
  const [show, setShow] = useState(false);
  const [phone, setPhone] = useState(initialPhone);
  const [password, setPassword] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!pending) onSubmit({ phone: phone.trim(), password });
      }}
      className="flex flex-col gap-4"
    >
      <h2 className="text-2xl">{t.t("auth.loginTitle")}</h2>

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

      <Field
        label={t.t("auth.password")}
        // In the label row because that is where someone looks the moment
        // the password will not come to mind.
        trailing={
          <button
            type="button"
            onClick={onForgot}
            className="text-accent cursor-pointer bg-transparent font-semibold"
          >
            {t.t("auth.forgotPassword")}
          </button>
        }
      >
        {(props) => (
          <PasswordInput
            {...props}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            show={show}
            onToggleShow={() => setShow(!show)}
            showLabel={show ? t.t("auth.hide") : t.t("auth.show")}
          />
        )}
      </Field>

      <AuthNotice error={error} onFix={onFix} />

      <SubmitButton
        disabled={phone.trim() === "" || password === "" || pending}
        aria-busy={pending || undefined}
      >
        {t.t("auth.logIn")}
      </SubmitButton>

      <OrDivider label={t.t("auth.or")} />
      <TelegramButton label={t.t("auth.telegramLogin")} />

      <div className="text-muted text-center text-[13px]">
        {t.t("auth.newHere")}{" "}
        <button
          type="button"
          onClick={onRegister}
          className="text-accent cursor-pointer bg-transparent font-semibold"
        >
          {t.t("auth.register")}
        </button>
      </div>
    </form>
  );
}
