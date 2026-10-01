"use client";

import { useState } from "react";
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
import { phoneSchema, type PhoneForm } from "../../lib/schemas";

/** Step 1: the number, and the two things the law requires us to ask. */
export function PhoneStep({
  onNext,
  onLogin,
}: {
  onNext: () => void;
  onLogin: () => void;
}) {
  const t = useTranslation();
  const rich = useRichTranslation();

  const [age, setAge] = useState(false);
  const [terms, setTerms] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<PhoneForm>({
    resolver: zodResolver(phoneSchema),
    mode: "onChange",
    defaultValues: { phone: "" },
  });

  const linkClass = "text-accent font-semibold";

  return (
    <form
      onSubmit={handleSubmit(() => onNext())}
      className="flex flex-col gap-4"
      noValidate
    >
      <h2 className="text-2xl">{t.t("auth.createTitle")}</h2>

      <Field
        label={t.t("auth.phone")}
        help={t.t("auth.phoneHelp")}
        error={errors.phone ? t.t("auth.phoneInvalid") : undefined}
      >
        {(props) => (
          <PhoneInput
            {...props}
            {...register("phone")}
            placeholder="912 345 482"
          />
        )}
      </Field>

      <div className="flex flex-col gap-1">
        <CheckboxRow checked={age} onChange={setAge} note={t.t("auth.ageNote")}>
          {t.t("auth.age")}
        </CheckboxRow>

        <CheckboxRow checked={terms} onChange={setTerms}>
          {rich("auth.termsConsent", {
            terms: (
              <Link href={routes.terms} className={linkClass}>
                {t.t("auth.termsLink")}
              </Link>
            ),
            privacy: (
              <Link href={routes.privacy} className={linkClass}>
                {t.t("auth.privacyLink")}
              </Link>
            ),
          })}
        </CheckboxRow>
      </div>

      {/* Both boxes and a usable number: this is the consent record, so it
          cannot be a formality the user clicks past. */}
      <SubmitButton disabled={!age || !terms || !isValid}>
        {t.t("auth.continue")}
      </SubmitButton>

      <OrDivider label={t.t("auth.or")} />
      <TelegramButton label={t.t("auth.telegramRegister")} />

      <div className="text-muted text-center text-[13px]">
        {t.t("auth.haveAccount")}{" "}
        <button
          type="button"
          onClick={onLogin}
          className="text-accent cursor-pointer bg-transparent font-semibold"
        >
          {t.t("auth.logInLink")}
        </button>
      </div>
    </form>
  );
}
