"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Field, PasswordInput, SubmitButton } from "@/components/ui/Field";
import { cn } from "@/lib/utils/cn";
import { passwordRules } from "../../lib/schemas";

/**
 * Step 3: the password.
 *
 * The rules are listed and tick off as they are met, rather than appearing as
 * errors after a rejected submit — the user should be able to see what is
 * expected before they are told they got it wrong.
 */
export function PasswordStep({ onNext }: { onNext: () => void }) {
  const t = useTranslation();
  const [show, setShow] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const checks = [
    { label: t.t("auth.rule8"), met: passwordRules.length(password) },
    {
      label: t.t("auth.ruleLetterNumber"),
      met: passwordRules.letterAndNumber(password),
    },
    {
      label: t.t("auth.ruleMatch"),
      met: passwordRules.match(password, confirm),
    },
  ];

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onNext();
      }}
      className="flex flex-col gap-4"
    >
      <h2 className="text-2xl">{t.t("auth.passwordTitle")}</h2>

      <Field label={t.t("auth.password")}>
        {(props) => (
          <PasswordInput
            {...props}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            show={show}
            onToggleShow={() => setShow(!show)}
            showLabel={show ? t.t("auth.hide") : t.t("auth.show")}
          />
        )}
      </Field>

      <Field label={t.t("auth.confirmPassword")}>
        {(props) => (
          <PasswordInput
            {...props}
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            show={show}
            onToggleShow={() => setShow(!show)}
            showLabel={show ? t.t("auth.hide") : t.t("auth.show")}
          />
        )}
      </Field>

      <ul className="flex list-none flex-col gap-1.5 p-0">
        {checks.map((check) => (
          <li key={check.label} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden
              className={cn(
                "size-2 shrink-0 rounded-md border",
                check.met
                  ? "border-accent bg-accent"
                  : "border-muted bg-raised",
              )}
            />
            <span className={check.met ? "text-text" : "text-muted"}>
              {check.label}
            </span>
          </li>
        ))}
      </ul>

      <SubmitButton disabled={!checks.every((c) => c.met)}>
        {t.t("auth.createAccount")}
      </SubmitButton>
    </form>
  );
}
