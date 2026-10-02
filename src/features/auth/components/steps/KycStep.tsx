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
import type { AuthErrorView } from "../../lib/errors";
import { finSchema, type FinForm } from "../../lib/schemas";
import { AuthNotice } from "../AuthNotice";

/**
 * Identity, via Fayda: the ID number and the consent to share it.
 *
 * Required before a withdrawal, not before a bet (C02 §2) — so it can be
 * deferred, and the note says exactly what deferring costs. Burying that would
 * leave someone discovering it when they try to take money out. The name and
 * date of birth Fayda is matched against were given when the account was
 * created.
 */
export function KycStep({
  initialFin = "",
  pending,
  error,
  onFix,
  onSubmit,
  onLater,
}: {
  initialFin?: string;
  pending: boolean;
  error: AuthErrorView | null;
  onFix: () => void;
  /** The number, digits only. */
  onSubmit: (fin: string) => void;
  onLater: () => void;
}) {
  const t = useTranslation();
  const [consent, setConsent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<FinForm, unknown, { fin: string }>({
    resolver: zodResolver(finSchema),
    mode: "onChange",
    defaultValues: { fin: initialFin },
  });

  const apiField = error?.fields?.fayda_number;
  const fieldError = errors.fin
    ? t.t("auth.finInvalid")
    : apiField !== undefined
      ? (apiField ?? t.t("auth.finInvalid"))
      : undefined;

  return (
    <form
      onSubmit={handleSubmit(({ fin }) => {
        if (!pending) onSubmit(fin);
      })}
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

      <Field label={t.t("auth.fin")} error={fieldError}>
        {(props) => (
          <TextInput
            {...props}
            {...register("fin")}
            inputMode="numeric"
            autoComplete="off"
            maxLength={16}
            placeholder="4821 0937 5516"
            className="text-[15px] tracking-[0.08em]"
          />
        )}
      </Field>

      <CheckboxRow checked={consent} onChange={setConsent}>
        {t.t("auth.kycConsent")}
      </CheckboxRow>

      <AuthNotice error={error} onFix={onFix} />

      <SubmitButton
        disabled={!consent || !isValid || pending}
        aria-busy={pending || undefined}
      >
        {t.t("auth.verifyWithFayda")}
      </SubmitButton>

      <button
        type="button"
        onClick={onLater}
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
