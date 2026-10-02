"use client";

import { useReducer } from "react";
import { useRichTranslation } from "@/lib/i18n/rich";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useFinishAuth } from "../../hooks/use-finish-auth";
import { useLogin } from "../../hooks/use-session";
import { initLogin, loginReducer } from "../../lib/flow";
import { maskPhone, toE164 } from "../../lib/phone";
import { useAuthStore } from "../../stores/auth.store";
import { AuthFrame } from "../AuthFrame";
import { LoginStep } from "../steps/LoginStep";
import { OtpStep } from "../steps/OtpStep";

/**
 * Log in (F4a): phone and password, and the SMS code when the API asks for one
 * on a new device. Nothing here decides who is signed in — the route handler
 * holds the session as an httpOnly cookie and `/api/me` says (AC-8).
 */
export function LoginFlow() {
  const t = useTranslation();
  const rich = useRichTranslation();
  const prefill = useAuthStore((s) => s.prefill);
  const switchTo = useAuthStore((s) => s.switchTo);
  const finish = useFinishAuth();

  const [login, dispatch] = useReducer(loginReducer, prefill, initLogin);
  const loginMutation = useLogin();

  const submit = async (form: {
    phone: string;
    password: string;
    challengeId?: string;
    otp?: string;
  }) => {
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

  const submitLogin = (form: { phone: string; password: string }) => {
    dispatch({ type: "submit", ...form });
    return submit(form);
  };

  const submitOtp = (otp: string) => {
    dispatch({ type: "submitOtp", otp });
    return submit({
      phone: login.phone,
      password: login.password,
      challengeId: login.challengeId ?? undefined,
      otp,
    });
  };

  const phone = toE164(login.phone);
  const masked = phone ? maskPhone(phone) : login.phone;

  return (
    <AuthFrame
      heading={t.t("auth.loginTitle")}
      onBack={
        login.step === "loginOtp" ? () => dispatch({ type: "back" }) : null
      }
    >
      {login.step === "login" && (
        <LoginStep
          initialPhone={login.phone}
          notice={
            login.notice === "passwordChanged"
              ? t.t("auth.passwordChanged")
              : null
          }
          pending={login.pending}
          error={login.error}
          onFix={() => dispatch({ type: "fix" })}
          onSubmit={submitLogin}
          onForgot={(typed) =>
            switchTo("forgot", { phone: typed, notice: null })
          }
          onRegister={() => switchTo("register")}
        />
      )}
      {login.step === "loginOtp" && (
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
    </AuthFrame>
  );
}
