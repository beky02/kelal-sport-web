"use client";

import { useReducer } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { usePublicConfig } from "@/features/config/hooks/use-public-config";
import { configKeys } from "@/lib/query/keys";
import { useRichTranslation } from "@/lib/i18n/rich";
import { useTranslation } from "@/lib/i18n/use-translation";
import { routes } from "@/config/routes";
import {
  useSendOtp,
  useStartFayda,
  useVerifyFayda,
} from "../../hooks/use-account";
import { useFinishAuth } from "../../hooks/use-finish-auth";
import { useRegister } from "../../hooks/use-session";
import { parseBirthDate } from "../../lib/birth-date";
import { isStaleTerms, type AuthFix } from "../../lib/errors";
import { maskPhone, toE164 } from "../../lib/phone";
import {
  canGoBack,
  initialRegister,
  liveChallengeFor,
  registerReducer,
  stepperIndex,
} from "../../lib/register-flow";
import { useAuthStore } from "../../stores/auth.store";
import { AuthFrame } from "../AuthFrame";
import { STEP_COUNT } from "../AuthStepper";
import { DetailsStep, type Details } from "../steps/DetailsStep";
import { KycResultStep } from "../steps/KycResultStep";
import { KycStep } from "../steps/KycStep";
import { OtpStep } from "../steps/OtpStep";
import { PhoneStep } from "../steps/PhoneStep";

/** C01 §9 `auth.min_age`, for a tenant whose config does not say. */
const DEFAULT_MIN_AGE = 21;

/**
 * Registration (C01 §8) and Fayda verification (C02 §8).
 *
 * `register`: phone and consents → SMS code → name, date of birth, password →
 * account created and signed in → Fayda ID, or later. `verify` is the ID step
 * alone, for a signed-in player who comes from the profile or the wallet.
 * Every call goes through this app's route handlers; every refusal is decided
 * by its code (`lib/errors.ts`) and offers its fix.
 */
export function RegisterFlow({ mode }: { mode: "register" | "verify" }) {
  const t = useTranslation();
  const rich = useRichTranslation();
  const router = useRouter();
  const switchTo = useAuthStore((s) => s.switchTo);
  const close = useAuthStore((s) => s.close);
  const finish = useFinishAuth();

  const queryClient = useQueryClient();
  const config = usePublicConfig();
  const legal = config.data?.legal;

  const [state, dispatch] = useReducer(registerReducer, mode, initialRegister);
  const sendOtp = useSendOtp();
  const register = useRegister();
  const startFayda = useStartFayda();
  const verifyFayda = useVerifyFayda();

  /**
   * The ticked boxes accept the terms on screen — or, when asked again, the
   * version the refusal named. A number that already has a live code goes
   * back to it: no second SMS, and no way round the resend wait.
   */
  const submitPhone = (phone: string) => {
    const shown = legal?.termsVersion ?? null;
    const live = liveChallengeFor(state, phone);
    if (state.reconsent) {
      const accepted = state.termsVersion ?? shown;
      if (live)
        return dispatch({ type: "reconsented", termsVersion: accepted });
      return sendCode(phone, accepted);
    }
    if (live) return dispatch({ type: "resume", termsVersion: shown });
    return sendCode(phone, shown);
  };

  const sendCode = async (
    phone: string,
    termsVersion: string | null = state.termsVersion,
  ) => {
    dispatch({ type: "sendCode", phone, termsVersion });
    try {
      const challenge = await sendOtp.mutateAsync({
        phone,
        purpose: "register",
      });
      dispatch({ type: "codeSent", challenge, now: Date.now() });
    } catch (error) {
      dispatch({ type: "failed", error, now: Date.now() });
    }
  };

  const createAccount = async (details: Details) => {
    const dateOfBirth = parseBirthDate(details.dateOfBirth);
    if (!state.challengeId || !dateOfBirth) return;
    dispatch({ type: "submitDetails", ...details });
    try {
      await register.mutateAsync({
        challengeId: state.challengeId,
        otp: state.otp,
        fullName: details.fullName,
        dateOfBirth,
        password: details.password,
        acceptTerms: true,
        termsVersion: state.termsVersion ?? "",
        ...(details.promoCode.trim()
          ? { promoCode: details.promoCode.trim() }
          : {}),
      });
      dispatch({ type: "created" });
    } catch (error) {
      // New terms: read them before the player is asked to accept again.
      if (isStaleTerms(error)) {
        void queryClient.invalidateQueries({ queryKey: configKeys.public() });
      }
      dispatch({ type: "failed", error });
    }
  };

  const sendFaydaCode = async (fin: string) => {
    dispatch({ type: "startFayda", fin });
    try {
      const challenge = await startFayda.mutateAsync({ faydaNumber: fin });
      dispatch({ type: "faydaSent", challenge });
    } catch (error) {
      dispatch({ type: "failed", error });
    }
  };

  const submitFaydaCode = async (otp: string) => {
    if (!state.caseId) return;
    dispatch({ type: "submitFaydaCode" });
    try {
      const result = await verifyFayda.mutateAsync({
        caseId: state.caseId,
        otp,
      });
      dispatch({ type: "verified", result });
    } catch (error) {
      dispatch({ type: "failed", error });
    }
  };

  const fix = (action: AuthFix | undefined) => {
    switch (action) {
      case "logInInstead":
        return switchTo("login", { phone: state.phone, notice: null });
      case "logInAgain":
        return switchTo("login");
      case "sendNewCode":
        return state.step === "kycOtp"
          ? sendFaydaCode(state.fin)
          : sendCode(state.phone);
      case "doThisLater":
        return finish();
      case "responsibleGaming":
        close();
        router.push(routes.responsibleGaming);
        return;
    }
  };
  const onFix = () => fix(state.error?.fix);

  const index = stepperIndex(state);
  const heading =
    index !== null
      ? t.t("auth.stepOf", { current: index + 1, total: STEP_COUNT })
      : state.step === "kyc" || state.step === "kycOtp"
        ? t.t("auth.kycTitle")
        : "";

  const phone = toE164(state.phone);
  const masked = phone ? maskPhone(phone) : state.phone;
  const faydaPhone = state.otpSentTo ?? "";

  return (
    <AuthFrame
      stepKey={state.step}
      heading={heading}
      onBack={canGoBack(state) ? () => dispatch({ type: "back" }) : null}
      stepper={index}
    >
      {state.step === "phone" && (
        <PhoneStep
          initialPhone={state.phone}
          minAge={legal?.minAge ?? DEFAULT_MIN_AGE}
          consented={state.consented}
          // The consent records the terms on screen: wait until they are known.
          pending={state.pending || config.isPending}
          error={state.error}
          onFix={onFix}
          onSubmit={submitPhone}
          onLogin={() => switchTo("login")}
        />
      )}
      {state.step === "otp" && (
        <OtpStep
          key={state.attempts}
          phoneMasked={masked}
          pending={state.pending}
          error={state.error}
          onFix={onFix}
          // Held, not checked: the API checks it with the details.
          onSubmit={(otp) => dispatch({ type: "enterCode", otp })}
          submitLabel={t.t("auth.continue")}
          onChangeNumber={() => dispatch({ type: "back" })}
          resendAt={state.resendAt}
          onResend={() => sendCode(state.phone)}
        />
      )}
      {state.step === "details" && (
        <DetailsStep
          initial={{
            fullName: state.fullName,
            dateOfBirth: state.dateOfBirth,
            password: state.password,
            promoCode: state.promoCode,
          }}
          pending={state.pending}
          error={state.error}
          onFix={onFix}
          onSubmit={createAccount}
        />
      )}
      {state.step === "kyc" && (
        <KycStep
          initialFin={state.fin}
          pending={state.pending}
          error={state.error}
          onFix={onFix}
          onSubmit={sendFaydaCode}
          onLater={finish}
        />
      )}
      {state.step === "kycOtp" && (
        <OtpStep
          key={state.attempts}
          phoneMasked={faydaPhone}
          body={rich("auth.faydaCodeBody", {
            phone: <span className="whitespace-nowrap">{faydaPhone}</span>,
          })}
          pending={state.pending}
          error={state.error}
          onFix={onFix}
          onSubmit={submitFaydaCode}
        />
      )}
      {state.step === "result" && state.result && (
        <KycResultStep
          result={state.result}
          doneLabel={
            mode === "verify" ? t.t("auth.done") : t.t("auth.startBetting")
          }
          onDone={finish}
          onRetry={() => dispatch({ type: "retryKyc" })}
          onLater={finish}
        />
      )}
    </AuthFrame>
  );
}
