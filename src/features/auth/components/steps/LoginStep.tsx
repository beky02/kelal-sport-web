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

export function LoginStep({
  onDone,
  onForgot,
  onRegister,
}: {
  onDone: () => void;
  onForgot: () => void;
  onRegister: () => void;
}) {
  const t = useTranslation();
  const [show, setShow] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onDone();
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
        label={
          <>
            <span>{t.t("auth.password")}</span>
            {/* In the label row because that is where someone looks the moment
                the password will not come to mind. */}
            <button
              type="button"
              onClick={onForgot}
              className="text-accent cursor-pointer bg-transparent font-semibold"
            >
              {t.t("auth.forgotPassword")}
            </button>
          </>
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

      <SubmitButton disabled={phone.trim() === "" || password === ""}>
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
