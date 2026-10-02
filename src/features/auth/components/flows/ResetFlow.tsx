"use client";

import { useReducer } from "react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useResetPassword, useSendOtp } from "../../hooks/use-account";
import { maskPhone, toE164 } from "../../lib/phone";
import {
  canGoBackReset,
  initialReset,
  resetReducer,
} from "../../lib/reset-flow";
import { useAuthStore } from "../../stores/auth.store";
import { AuthFrame } from "../AuthFrame";
import { ForgotStep } from "../steps/ForgotStep";
import { OtpStep } from "../steps/OtpStep";
import { PasswordStep } from "../steps/PasswordStep";

/**
 * A forgotten password (REG-09): phone → SMS code → new password → back to log
 * in with the phone kept and a notice. The code step never says whether the
 * phone has an account (C01 §10). The API revokes that account's sessions;
 * nobody is signed in here.
 */
export function ResetFlow() {
  const t = useTranslation();
  const prefill = useAuthStore((s) => s.prefill);
  const switchTo = useAuthStore((s) => s.switchTo);

  const [state, dispatch] = useReducer(
    resetReducer,
    prefill?.phone ?? "",
    initialReset,
  );
  const sendOtp = useSendOtp();
  const resetPassword = useResetPassword();

  const sendCode = async (phone: string) => {
    dispatch({ type: "sendCode", phone });
    try {
      const challenge = await sendOtp.mutateAsync({ phone, purpose: "reset" });
      dispatch({ type: "codeSent", challenge, now: Date.now() });
    } catch (error) {
      dispatch({ type: "failed", error });
    }
  };

  const save = async (newPassword: string) => {
    if (!state.challengeId) return;
    dispatch({ type: "submitPassword", newPassword });
    try {
      await resetPassword.mutateAsync({
        challengeId: state.challengeId,
        otp: state.otp,
        newPassword,
      });
      switchTo("login", { phone: state.phone, notice: "passwordChanged" });
    } catch (error) {
      dispatch({ type: "failed", error });
    }
  };

  const toLogin = (phone: string) => switchTo("login", { phone, notice: null });

  const onFix = () => {
    if (state.error?.fix === "sendNewCode") void sendCode(state.phone);
  };

  const phone = toE164(state.phone);
  const masked = phone ? maskPhone(phone) : state.phone;

  return (
    <AuthFrame
      heading={t.t("auth.resetTitle")}
      onBack={
        state.step === "phone"
          ? () => toLogin(state.phone)
          : canGoBackReset(state)
            ? () => dispatch({ type: "back" })
            : null
      }
    >
      {state.step === "phone" && (
        <ForgotStep
          initialPhone={state.phone}
          pending={state.pending}
          error={state.error}
          onFix={onFix}
          onSubmit={sendCode}
          onBackToLogin={toLogin}
        />
      )}
      {state.step === "otp" && (
        <OtpStep
          key={state.attempts}
          phoneMasked={masked}
          body={t.t("auth.resetCodeBody", { phone: masked })}
          pending={state.pending}
          error={state.error}
          onFix={onFix}
          onSubmit={(otp) => dispatch({ type: "enterCode", otp })}
          submitLabel={t.t("auth.continue")}
          onChangeNumber={() => dispatch({ type: "back" })}
          resendAt={state.resendAt}
          onResend={() => sendCode(state.phone)}
        />
      )}
      {state.step === "password" && (
        <PasswordStep
          initialPassword={state.newPassword}
          pending={state.pending}
          error={state.error}
          onFix={onFix}
          onSubmit={save}
        />
      )}
    </AuthFrame>
  );
}
