"use client";

import { useId, useState } from "react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Field, PasswordInput } from "@/components/ui/Field";
import { cn } from "@/lib/utils/cn";
import { PASSWORD_MAX, passwordRules } from "../../lib/schemas";

/** Both rules met: long enough, and typed the same twice. */
export const passwordReady = (password: string, confirm: string) =>
  passwordRules.length(password) && passwordRules.match(password, confirm);

/**
 * A new password, typed twice.
 *
 * The rules are listed and tick off as they are met, rather than appearing as
 * errors after a rejected submit — the user should be able to see what is
 * expected before they are told they got it wrong. Only length and a match
 * (C01 §2): no composition rules. A password the API refuses (a breached one)
 * comes back as `error`, under the field.
 */
export function PasswordFields({
  label,
  password,
  confirm,
  onPassword,
  onConfirm,
  error,
}: {
  label: string;
  password: string;
  confirm: string;
  onPassword: (value: string) => void;
  onConfirm: (value: string) => void;
  error?: string;
}) {
  const t = useTranslation();
  const [show, setShow] = useState(false);
  const rulesId = useId();

  const checks = [
    { label: t.t("auth.rule8"), met: passwordRules.length(password) },
    {
      label: t.t("auth.ruleMatch"),
      met: passwordRules.match(password, confirm),
    },
  ];

  return (
    <>
      <Field label={label} error={error}>
        {(props) => (
          <PasswordInput
            {...props}
            // The rules are read with the field, each with whether it is met.
            aria-describedby={[props["aria-describedby"], rulesId]
              .filter(Boolean)
              .join(" ")}
            autoComplete="new-password"
            maxLength={PASSWORD_MAX}
            value={password}
            onChange={(event) => onPassword(event.target.value)}
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
            maxLength={PASSWORD_MAX}
            value={confirm}
            onChange={(event) => onConfirm(event.target.value)}
            show={show}
            onToggleShow={() => setShow(!show)}
            showLabel={show ? t.t("auth.hide") : t.t("auth.show")}
          />
        )}
      </Field>

      <ul id={rulesId} className="flex list-none flex-col gap-1.5 p-0">
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
            </span>{" "}
            <span className="sr-only">
              {check.met ? t.t("auth.ruleMet") : t.t("auth.ruleNotMet")}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
