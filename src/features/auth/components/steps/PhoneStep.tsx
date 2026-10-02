"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useRichTranslation } from "@/lib/i18n/rich";
import {
  CheckboxRow,
  Field,
  OrDivider,
  PhoneInput,
  SubmitButton,
  TelegramButton,
} from "@/components/ui/Field";
import { routes } from "@/config/routes";
import type { AuthErrorView } from "../../lib/errors";
import { phoneSchema, type PhoneForm } from "../../lib/schemas";
import { AuthNotice } from "../AuthNotice";

/**
 * Legal pages open in a new tab, so the flow — and what the player has typed —
 * stays. Inside the consent's `<label>` a link is followed, not counted as a
 * tick.
 */
const NEW_TAB = { target: "_blank", rel: "noopener noreferrer" } as const;

/** Step 1: the number, and the two things the law requires us to ask. */
export function PhoneStep({
  initialPhone = "",
  minAge,
  consented = false,
  pending = false,
  error = null,
  onFix,
  onSubmit,
  onLogin,
}: {
  initialPhone?: string;
  /** The tenant's minimum age (`legal.min_age`), stated in the age consent. */
  minAge: number;
  /** Both boxes were ticked before (the player came back to change the number). */
  consented?: boolean;
  pending?: boolean;
  error?: AuthErrorView | null;
  onFix?: () => void;
  onSubmit: (phone: string) => void;
  onLogin: () => void;
}) {
  const t = useTranslation();
  const rich = useRichTranslation();

  const [age, setAge] = useState(consented);
  const [terms, setTerms] = useState(consented);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isValid },
  } = useForm<PhoneForm>({
    resolver: zodResolver(phoneSchema),
    mode: "onChange",
    defaultValues: { phone: initialPhone },
  });

  const { ref: registerPhone, ...phoneField } = register("phone");
  const phoneInput = useRef<HTMLInputElement | null>(null);

  // The caret starts in the number, as on log in: this step is the form.
  useEffect(() => {
    phoneInput.current?.focus();
  }, []);

  const apiField = error?.fields?.phone;
  const fieldError = errors.phone
    ? t.t("auth.phoneInvalid")
    : apiField !== undefined
      ? (apiField ?? t.t("auth.phoneInvalid"))
      : undefined;

  const linkClass = "text-accent font-semibold";

  return (
    <form
      onSubmit={handleSubmit(() => {
        if (!pending) onSubmit(getValues("phone").trim());
      })}
      className="flex flex-col gap-4"
      noValidate
    >
      <h2 className="text-2xl">{t.t("auth.createTitle")}</h2>

      <Field
        label={t.t("auth.phone")}
        help={t.t("auth.phoneHelp")}
        error={fieldError}
      >
        {(props) => (
          <PhoneInput
            {...props}
            {...phoneField}
            ref={(element) => {
              registerPhone(element);
              phoneInput.current = element;
            }}
            placeholder="912 345 482"
          />
        )}
      </Field>

      <div className="flex flex-col gap-1">
        <CheckboxRow
          checked={age}
          onChange={setAge}
          note={t.t("auth.ageNote", { age: minAge })}
        >
          {t.t("auth.age", { age: minAge })}
        </CheckboxRow>

        <CheckboxRow checked={terms} onChange={setTerms}>
          {rich("auth.termsConsent", {
            terms: (
              <Link href={routes.terms} className={linkClass} {...NEW_TAB}>
                {t.t("auth.termsLink")}{" "}
                <span className="sr-only">{t.t("auth.opensInNewTab")}</span>
              </Link>
            ),
            privacy: (
              <Link href={routes.privacy} className={linkClass} {...NEW_TAB}>
                {t.t("auth.privacyLink")}{" "}
                <span className="sr-only">{t.t("auth.opensInNewTab")}</span>
              </Link>
            ),
          })}
        </CheckboxRow>
      </div>

      <AuthNotice error={error} onFix={onFix} />

      {/* Both boxes and a usable number: this is the consent record, so it
          cannot be a formality the user clicks past. */}
      <SubmitButton
        disabled={!age || !terms || !isValid || pending}
        aria-busy={pending || undefined}
      >
        {t.t("auth.continue")}
      </SubmitButton>

      <OrDivider label={t.t("auth.or")} />
      <TelegramButton label={t.t("auth.telegramRegister")} />

      <div className="text-muted text-center text-[13px]">
        {t.t("auth.haveAccount")}{" "}
        <button
          type="button"
          onClick={onLogin}
          className="text-accent -my-3 inline-flex min-h-11 items-center cursor-pointer bg-transparent font-semibold"
        >
          {t.t("auth.logInLink")}
        </button>
      </div>
    </form>
  );
}
