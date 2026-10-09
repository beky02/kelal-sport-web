"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Field, SubmitButton, TextInput } from "@/components/ui/Field";
import { parseBirthDate } from "../../lib/birth-date";
import type { AuthErrorView } from "../../lib/errors";
import { AuthNotice } from "../AuthNotice";
import { PasswordFields, passwordReady } from "./PasswordFields";

export interface Details {
  fullName: string;
  /** As typed, `DD/MM/YYYY`. */
  dateOfBirth: string;
  password: string;
  /** Optional (REG-12): a promo code for the new account, as typed. */
  promoCode: string;
}

const NAME_MIN = 3;
/** The contract's `promo_code` maximum. */
const PROMO_MAX = 64;
const NAME_MAX = 100;

/**
 * Step 3: who the player is, and a password.
 *
 * The name and date of birth are what the account is created with (the
 * contract requires them) and what Fayda is later matched against, so they
 * are asked as they appear on the ID. Whether the date makes the player old
 * enough is the API's to say (`REG_UNDERAGE`); here it only has to be a date.
 */
export function DetailsStep({
  initial,
  pending,
  error,
  onFix,
  onSubmit,
}: {
  initial: Details;
  pending: boolean;
  error: AuthErrorView | null;
  onFix: () => void;
  onSubmit: (details: Details) => void;
}) {
  const t = useTranslation();
  const [fullName, setFullName] = useState(initial.fullName);
  const [dateOfBirth, setDateOfBirth] = useState(initial.dateOfBirth);
  const [password, setPassword] = useState(initial.password);
  const [confirm, setConfirm] = useState(initial.password);
  const [promoCode, setPromoCode] = useState(initial.promoCode);
  const [touched, setTouched] = useState({ name: false, date: false });

  const nameOk = fullName.trim().length >= NAME_MIN;
  const dateOk = parseBirthDate(dateOfBirth) !== null;

  /** The API's word on a field wins; then ours, once the player has left it. */
  const fieldError = (
    field: string,
    local: string | undefined,
  ): string | undefined => {
    const api = error?.fields?.[field];
    if (api !== undefined) return api ?? t.t("auth.fieldInvalid");
    return local;
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (pending || !nameOk || !dateOk || !passwordReady(password, confirm))
          return;
        onSubmit({
          fullName: fullName.trim(),
          dateOfBirth,
          password,
          promoCode,
        });
      }}
      className="flex flex-col gap-4"
      noValidate
    >
      <div>
        <h2 className="mb-1.5 text-2xl">{t.t("auth.detailsTitle")}</h2>
        <div className="text-muted text-pretty">{t.t("auth.detailsBody")}</div>
      </div>

      <Field
        label={t.t("auth.fullName")}
        error={fieldError(
          "full_name",
          touched.name && !nameOk ? t.t("auth.fullNameInvalid") : undefined,
        )}
      >
        {(props) => (
          <TextInput
            {...props}
            autoComplete="name"
            maxLength={NAME_MAX}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            onBlur={() => setTouched((s) => ({ ...s, name: true }))}
            placeholder={t.t("auth.fullNamePlaceholder")}
          />
        )}
      </Field>

      <Field
        label={t.t("auth.dateOfBirth")}
        // The format stays in view once the placeholder has gone.
        help={t.t("auth.dateOfBirthHelp")}
        error={fieldError(
          "date_of_birth",
          touched.date && !dateOk ? t.t("auth.dateOfBirthInvalid") : undefined,
        )}
      >
        {(props) => (
          <TextInput
            {...props}
            autoComplete="bday"
            inputMode="numeric"
            maxLength={14}
            value={dateOfBirth}
            onChange={(event) => setDateOfBirth(event.target.value)}
            onBlur={() => setTouched((s) => ({ ...s, date: true }))}
            placeholder="14 / 03 / 1996"
          />
        )}
      </Field>

      <PasswordFields
        label={t.t("auth.password")}
        password={password}
        confirm={confirm}
        onPassword={setPassword}
        onConfirm={setConfirm}
        error={fieldError("password", undefined)}
      />

      <Field
        label={t.t("auth.promoCode")}
        help={t.t("auth.promoCodeHelp")}
        // A refused code is said here, where it can be changed or emptied.
        error={
          error?.field === "promo_code" && error.key
            ? t.t(error.key)
            : fieldError("promo_code", undefined)
        }
      >
        {(props) => (
          <TextInput
            {...props}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={PROMO_MAX}
            value={promoCode}
            onChange={(event) => setPromoCode(event.target.value)}
            // O and 0 must look different in a code.
            className="font-mono slashed-zero"
          />
        )}
      </Field>

      <AuthNotice error={error?.field ? null : error} onFix={onFix} />

      <SubmitButton
        disabled={
          pending || !nameOk || !dateOk || !passwordReady(password, confirm)
        }
        aria-busy={pending || undefined}
      >
        {t.t("auth.createAccount")}
      </SubmitButton>
    </form>
  );
}
