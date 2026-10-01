"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "@/lib/i18n/use-translation";
import {
  CheckboxRow,
  Field,
  SubmitButton,
  TextInput,
} from "@/components/ui/Field";
import { kycSchema, type KycForm } from "../../lib/schemas";

/**
 * Step 4: identity, via Fayda.
 *
 * Required before a withdrawal, not before a bet — so it can be deferred, and
 * the note says exactly what deferring costs. Burying that would leave someone
 * discovering it when they try to take money out.
 */
export function KycStep({
  onNext,
  onSkip,
}: {
  onNext: () => void;
  onSkip: () => void;
}) {
  const t = useTranslation();
  const [consent, setConsent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<KycForm>({
    resolver: zodResolver(kycSchema),
    mode: "onChange",
    defaultValues: { fin: "", fullName: "", dateOfBirth: "" },
  });

  return (
    <form
      onSubmit={handleSubmit(() => onNext())}
      className="flex flex-col gap-4"
      noValidate
    >
      <div>
        <h2 className="mb-1.5 text-2xl">{t.t("auth.kycTitle")}</h2>
        <div className="text-muted text-pretty">{t.t("auth.kycBody")}</div>
      </div>

      <div className="bg-surface flex items-center gap-3 rounded-lg p-3">
        <div className="border-accent text-accent font-display grid h-[30px] w-11 shrink-0 place-items-center rounded-md border text-xs tracking-[0.04em]">
          FAYDA
        </div>
        <div className="text-xs">
          <div className="font-semibold">{t.t("auth.faydaTitle")}</div>
          <div className="text-muted">{t.t("auth.faydaBody")}</div>
        </div>
      </div>

      <Field
        label={t.t("auth.fin")}
        error={errors.fin ? t.t("auth.finInvalid") : undefined}
      >
        {(props) => (
          <TextInput
            {...props}
            {...register("fin")}
            inputMode="numeric"
            placeholder="4821 0937 5516"
            className="text-[15px] tracking-[0.08em]"
          />
        )}
      </Field>

      <Field
        label={t.t("auth.fullName")}
        error={errors.fullName ? t.t("auth.required") : undefined}
      >
        {(props) => (
          <TextInput
            {...props}
            {...register("fullName")}
            autoComplete="name"
            placeholder="Abebe Kebede Tesfaye"
          />
        )}
      </Field>

      <Field
        label={t.t("auth.dateOfBirth")}
        error={errors.dateOfBirth ? t.t("auth.required") : undefined}
      >
        {(props) => (
          <TextInput
            {...props}
            {...register("dateOfBirth")}
            placeholder="14 / 03 / 1996"
          />
        )}
      </Field>

      <CheckboxRow checked={consent} onChange={setConsent}>
        {t.t("auth.kycConsent")}
      </CheckboxRow>

      <SubmitButton disabled={!consent || !isValid}>
        {t.t("auth.verifyWithFayda")}
      </SubmitButton>

      <button
        type="button"
        onClick={onSkip}
        className="bg-raised text-text font-body h-12 cursor-pointer rounded-md text-sm font-bold"
      >
        {t.t("auth.doThisLater")}
      </button>

      <p className="text-muted text-[11px] text-pretty">
        {t.t("auth.laterNote")}
      </p>
    </form>
  );
}
