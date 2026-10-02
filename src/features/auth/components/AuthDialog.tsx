"use client";

import { useReducer } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { ChevronLeft, X } from "lucide-react";
import { useRichTranslation } from "@/lib/i18n/rich";
import { useTranslation } from "@/lib/i18n/use-translation";
import { routes } from "@/config/routes";
import { useLogin } from "../hooks/use-session";
import { initialLogin, loginReducer } from "../lib/flow";
import { safeNextPath } from "../lib/paths";
import { maskPhone, toE164 } from "../lib/phone";
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
 * route handlers hold the session as an httpOnly cookie, and `/api/me` is what
 * says who is signed in (AC-8). Registration's steps are wired in F4b; until
 * then they close the dialog.
 */
export function AuthDialog() {
  const t = useTranslation();
  const rich = useRichTranslation();
  const router = useRouter();
  const pathname = usePathname();

  const step = useAuthStore((s) => s.step);
  const next = useAuthStore((s) => s.next);
  const goTo = useAuthStore((s) => s.goTo);
  const close = useAuthStore((s) => s.close);

  const [login, dispatch] = useReducer(loginReducer, initialLogin);
  const loginMutation = useLogin();

  if (step === null) return null;

  const index = stepIndex(step);
  const inRegistration = index >= 0 && index < STEP_COUNT;

  const dismiss = () => {
    dispatch({ type: "done" });
    close();
  };

  /** Signed in: back to where the player was going, when they were going somewhere. */
  const finish = () => {
    const destination =
      next !== null || pathname === routes.login || pathname === routes.register
        ? safeNextPath(next)
        : null;
    dismiss();
    if (destination !== null) router.replace(destination);
  };

  const submitLogin = async (form: { phone: string; password: string }) => {
    dispatch({ type: "submit", ...form });
    try {
      const result = await loginMutation.mutateAsync(form);
      if (result.status === "otp_required") {
        dispatch({ type: "otpRequired", ...result });
      } else {
        finish();
      }
    } catch (error) {
      dispatch({ type: "failed", error });
    }
  };

  const submitOtp = async (otp: string) => {
    dispatch({ type: "submitOtp", otp });
    try {
      const result = await loginMutation.mutateAsync({
        phone: login.phone,
        password: login.password,
        challengeId: login.challengeId ?? undefined,
        otp,
      });
      if (result.status === "otp_required") {
        dispatch({ type: "otpRequired", ...result });
      } else {
        finish();
      }
    } catch (error) {
      dispatch({ type: "failed", error });
    }
  };

  const advance = () =>
    goTo(
      REGISTRATION_STEPS[Math.min(index + 1, REGISTRATION_STEPS.length - 1)],
    );

  const goBack = () => {
    if (step === "login" && login.step === "loginOtp")
      dispatch({ type: "back" });
    else if (inRegistration && index > 0) goTo(REGISTRATION_STEPS[index - 1]);
    else if (step === "forgot") goTo("login");
    else dismiss();
  };

  const heading = inRegistration
    ? t.t("auth.stepOf", { current: index + 1, total: STEP_COUNT })
    : step === "login"
      ? t.t("auth.loginTitle")
      : step === "forgot"
        ? t.t("auth.resetTitle")
        : "";

  const loginPhone = toE164(login.phone);
  const masked = loginPhone ? maskPhone(loginPhone) : login.phone;

  // On the first step of either flow the arrow could only close the dialog,
  // which the cross already does.
  const canGoBack = !(
    step === "phone" ||
    (step === "login" && login.step === "login")
  );
  // The login form puts the caret in its first field itself.
  const focusesItself = step === "login" && login.step === "login";

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) dismiss();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content
          onOpenAutoFocus={(event) => {
            if (focusesItself) event.preventDefault();
          }}
          className="bg-ground border-border fixed top-1/2 left-1/2 z-40 flex max-h-[92dvh] w-[440px] max-w-[calc(100vw-2.5rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border outline-none"
        >
          <Dialog.Title className="sr-only">
            {t.t("auth.dialogLabel")}
          </Dialog.Title>

          <div className="border-divider grid min-h-12 shrink-0 grid-cols-[44px_minmax(0,1fr)_44px] items-center border-b px-1">
            {canGoBack ? (
              <button
                type="button"
                aria-label={t.t("auth.back")}
                onClick={goBack}
                className="text-text grid size-11 cursor-pointer place-items-center rounded-md bg-transparent"
              >
                <ChevronLeft size={20} strokeWidth={1.5} aria-hidden />
              </button>
            ) : (
              <span aria-hidden />
            )}

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
                onSubmit={advance}
                onResend={() => {}}
                onChangeNumber={() => goTo("phone")}
              />
            )}
            {step === "password" && <PasswordStep onNext={advance} />}
            {step === "kyc" && <KycStep onNext={advance} onSkip={dismiss} />}
            {step === "kycDone" && <KycPendingStep onDone={dismiss} />}
            {step === "login" && login.step === "login" && (
              <LoginStep
                initialPhone={login.phone}
                pending={login.pending}
                error={login.error}
                onFix={() => dispatch({ type: "fix" })}
                onSubmit={submitLogin}
                onForgot={() => goTo("forgot")}
                onRegister={() => goTo("phone")}
              />
            )}
            {step === "login" && login.step === "loginOtp" && (
              <OtpStep
                key={login.attempts}
                phoneMasked={masked}
                body={rich("auth.newDeviceBody", {
                  phone: <span className="whitespace-nowrap">{masked}</span>,
                })}
                pending={login.pending}
                error={login.error}
                onFix={() => dispatch({ type: "fix" })}
                onSubmit={submitOtp}
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
