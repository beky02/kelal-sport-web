"use client";

import { Dialog } from "radix-ui";
import { ChevronLeft, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useSessionStore } from "@/stores/session.store";
import { useAuthStore } from "../stores/auth.store";
import { REGISTRATION_STEPS, STEP_COUNT, stepIndex } from "../types";
import { AuthStepper } from "./AuthStepper";
import { ForgotStep } from "./steps/ForgotStep";
import { KycPendingStep } from "./steps/KycPendingStep";
import { KycStep } from "./steps/KycStep";
import { LoginStep } from "./steps/LoginStep";
import { OtpStep } from "./steps/OtpStep";
import { PasswordStep } from "./steps/PasswordStep";
import { PhoneStep } from "./steps/PhoneStep";

/**
 * Registration and login, over the page.
 *
 * A dialog rather than a route so that closing it returns the user to exactly
 * what they were doing — most people meet this flow because they tried to place
 * a bet, and losing the slip on the way to logging in would be the wrong trade.
 *
 * Nothing here authenticates anyone. The steps collect input and hand off; the
 * backend issues the session as an HttpOnly cookie, and `/me` is what says who
 * is signed in.
 */
export function AuthDialog() {
  const t = useTranslation();
  const step = useAuthStore((s) => s.step);
  const goTo = useAuthStore((s) => s.goTo);
  const close = useAuthStore((s) => s.close);
  const setGuest = useSessionStore((s) => s.setGuest);

  if (step === null) return null;

  const index = stepIndex(step);
  const inRegistration = index >= 0 && index < STEP_COUNT;

  const finish = () => {
    setGuest(false);
    close();
  };

  const advance = () =>
    goTo(
      REGISTRATION_STEPS[Math.min(index + 1, REGISTRATION_STEPS.length - 1)],
    );

  const goBack = () => {
    if (inRegistration && index > 0) goTo(REGISTRATION_STEPS[index - 1]);
    else if (step === "forgot") goTo("login");
    else close();
  };

  const heading = inRegistration
    ? t.t("auth.stepOf", { current: index + 1, total: STEP_COUNT })
    : step === "login"
      ? t.t("auth.loginTitle")
      : step === "forgot"
        ? t.t("auth.resetTitle")
        : "";

  return (
    <Dialog.Root
      open
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content className="bg-ground border-border fixed top-1/2 left-1/2 z-40 flex max-h-[92dvh] w-[440px] max-w-[calc(100vw-2.5rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border outline-none">
          <Dialog.Title className="sr-only">
            {t.t("auth.dialogLabel")}
          </Dialog.Title>

          <div className="border-divider grid min-h-12 shrink-0 grid-cols-[44px_minmax(0,1fr)_44px] items-center border-b px-1">
            <button
              type="button"
              aria-label={t.t("auth.back")}
              onClick={goBack}
              className="text-text grid size-11 cursor-pointer place-items-center rounded-md bg-transparent"
            >
              <ChevronLeft size={20} strokeWidth={1.5} aria-hidden />
            </button>

            <div className="text-muted text-center text-xs">{heading}</div>

            <Dialog.Close
              aria-label={t.t("betSlip.close")}
              className="text-text hover:bg-raised grid size-11 cursor-pointer place-items-center rounded-md bg-transparent"
            >
              <X size={18} strokeWidth={1.5} aria-hidden />
            </Dialog.Close>
          </div>

          {inRegistration && <AuthStepper current={index} />}

          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pt-5.5 pb-7">
            {step === "phone" && (
              <PhoneStep onNext={advance} onLogin={() => goTo("login")} />
            )}
            {step === "otp" && (
              <OtpStep
                phoneMasked="+251 9•• ••• 482"
                onNext={advance}
                onChangeNumber={() => goTo("phone")}
              />
            )}
            {step === "password" && <PasswordStep onNext={advance} />}
            {step === "kyc" && <KycStep onNext={advance} onSkip={finish} />}
            {step === "kycDone" && <KycPendingStep onDone={finish} />}
            {step === "login" && (
              <LoginStep
                onDone={finish}
                onForgot={() => goTo("forgot")}
                onRegister={() => goTo("phone")}
              />
            )}
            {step === "forgot" && (
              <ForgotStep
                onSent={() => goTo("otp")}
                onBackToLogin={() => goTo("login")}
              />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
