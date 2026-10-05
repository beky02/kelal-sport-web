"use client";

import { useTranslation, type Translator } from "@/lib/i18n/use-translation";
import type { DepositFix, DepositNotice, DepositText } from "../lib/deposit";
import { PaymentNotice } from "./PaymentNotice";

/** A deposit message in the language on screen, its amounts formatted. */
function say(t: Translator, text: DepositText | { text: string }): string {
  if ("text" in text) return text.text;
  const { key, method, amount, min, max, date } = text;
  return t.t(key, {
    ...(method !== undefined ? { method } : {}),
    ...(amount !== undefined ? { amount: t.money(amount) } : {}),
    ...(min !== undefined ? { min: t.money(min) } : {}),
    ...(max !== undefined ? { max: t.money(max) } : {}),
    ...(date !== undefined ? { date } : {}),
  });
}

/**
 * The deposit had no answer: it may have started. Only Try again — the same
 * request with the same key — may go, so the player never starts a second
 * deposit by tapping again.
 */
export function DepositUnanswered() {
  const t = useTranslation();
  return (
    <PaymentNotice
      tone="pending"
      title={t.t("deposit.unconfirmedTitle")}
      lines={[t.t("deposit.unconfirmedBody")]}
    />
  );
}

/**
 * The API refused the deposit: what happened, the API's own detail as its
 * own line, and each fix it allows as a button (docs/design/05).
 */
export function DepositRefused({
  notice,
  onFix,
}: {
  notice: DepositNotice;
  onFix: (fix: DepositFix) => void;
}) {
  const t = useTranslation();
  const label = (fix: DepositFix): string => {
    switch (fix.kind) {
      case "chooseMethod":
        return t.t("wallet.otherMethod");
      case "amount":
        return t.t("deposit.depositAmount", { amount: t.money(fix.amount) });
      case "changeAmount":
        return t.t("deposit.changeAmount");
      case "retry":
        return t.t("wallet.tryAgain");
      case "viewLimits":
        return t.t("system.viewLimits");
      case "verify":
        return t.t("wallet.verifyNow");
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
