"use client";

import { useTranslation, type Translator } from "@/lib/i18n/use-translation";
import type {
  WithdrawalFix,
  WithdrawalNotice,
  WithdrawalText,
} from "../lib/withdrawal";
import { PaymentNotice } from "./PaymentNotice";

/** A withdrawal message in the language on screen, its amounts formatted. */
function say(t: Translator, text: WithdrawalText | { text: string }): string {
  if ("text" in text) return text.text;
  const { key, method, amount, min, max } = text;
  return t.t(key, {
    ...(method !== undefined ? { method } : {}),
    ...(amount !== undefined ? { amount: t.money(amount) } : {}),
    ...(min !== undefined ? { min: t.money(min) } : {}),
    ...(max !== undefined ? { max: t.money(max) } : {}),
  });
}

/**
 * The withdrawal had no answer: it may have gone through. Only Try again —
 * the same request with the same key — may go, so the player never asks for
 * a second withdrawal by tapping again.
 */
export function WithdrawUnanswered() {
  const t = useTranslation();
  return (
    <PaymentNotice
      tone="pending"
      title={t.t("withdraw.unconfirmedTitle")}
      lines={[t.t("withdraw.unconfirmedBody")]}
    />
  );
}

/**
 * The API refused the withdrawal: what happened, the API's own detail as its
 * own line, and each fix it allows as a button (docs/design/05).
 */
export function WithdrawRefused({
  notice,
  onFix,
}: {
  notice: WithdrawalNotice;
  onFix: (fix: WithdrawalFix) => void;
}) {
  const t = useTranslation();
  const label = (fix: WithdrawalFix): string => {
    switch (fix.kind) {
      case "chooseMethod":
        return t.t("wallet.otherMethod");
      case "chooseAccount":
        return t.t("withdraw.chooseAccount");
      case "amount":
        return t.t("withdraw.withdrawAmount", { amount: t.money(fix.amount) });
      case "changeAmount":
        return t.t("deposit.changeAmount");
      case "retry":
        return t.t("wallet.tryAgain");
      case "verify":
        return t.t("wallet.verifyNow");
      case "keepWagering":
        return t.t("withdraw.keepWagering");
      case "help":
        return t.t("withdraw.contactSupport");
    }
  };

  return (
    <PaymentNotice
      tone="refused"
      title={say(t, notice.title)}
      lines={[say(t, notice.body), notice.detail]}
      actions={notice.fixes.map((fix) => ({
        label: label(fix),
        onClick: () => onFix(fix),
      }))}
    />
  );
}
