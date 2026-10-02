"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { SubmitButton } from "@/components/ui/Field";
import type { AuthErrorView } from "../../lib/errors";
import { AuthNotice } from "../AuthNotice";
import { PasswordFields, passwordReady } from "./PasswordFields";

/** A forgotten password's last step: the new one, typed twice. */
export function PasswordStep({
  initialPassword,
  pending,
  error,
  onFix,
  onSubmit,
}: {
  initialPassword: string;
  pending: boolean;
  error: AuthErrorView | null;
  onFix: () => void;
  onSubmit: (newPassword: string) => void;
}) {
  const t = useTranslation();
  const [password, setPassword] = useState(initialPassword);
  const [confirm, setConfirm] = useState(initialPassword);

  const apiField = error?.fields?.new_password;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!pending && passwordReady(password, confirm)) onSubmit(password);
      }}
      className="flex flex-col gap-4"
    >
      <h2 className="text-2xl">{t.t("auth.newPasswordTitle")}</h2>

      <PasswordFields
        label={t.t("auth.newPassword")}
        password={password}
        confirm={confirm}
        onPassword={setPassword}
        onConfirm={setConfirm}
        error={
          apiField === undefined
            ? undefined
            : (apiField ?? t.t("auth.fieldInvalid"))
        }
      />

      <AuthNotice error={error} onFix={onFix} />

      <SubmitButton
        disabled={pending || !passwordReady(password, confirm)}
        aria-busy={pending || undefined}
      >
        {t.t("auth.savePassword")}
      </SubmitButton>
    </form>
  );
}
