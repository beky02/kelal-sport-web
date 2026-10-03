"use client";

import { CircleAlert, Clock } from "lucide-react";
import { useTranslation, type Translator } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils/cn";
import type { DepositFix, DepositNotice, DepositText } from "../lib/deposit";

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
    <div
      role="alert"
      className="bg-raised border-accent flex gap-2.5 rounded-md border p-3"
    >
      <Clock
        size={17}
        strokeWidth={1.5}
        aria-hidden
        className="text-accent mt-0.5 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="font-bold">{t.t("deposit.unconfirmedTitle")}</div>
        <p className="text-muted text-xs text-pretty">
          {t.t("deposit.unconfirmedBody")}
        </p>
      </div>
    </div>
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
    <div
      role="alert"
      className="bg-loss-bg flex flex-col gap-2.5 rounded-md p-3"
    >
      <div className="flex gap-2.5">
        <CircleAlert
          size={17}
          strokeWidth={1.5}
          aria-hidden
          className="text-loss mt-0.5 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="font-bold">{say(t, notice.title)}</div>
          <p className="text-muted text-xs text-pretty">
            {say(t, notice.body)}
          </p>
          {notice.detail && (
            <p className="text-muted mt-1 text-xs text-pretty">
              {notice.detail}
            </p>
          )}
        </div>
      </div>
      {notice.fixes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {notice.fixes.map((fix, i) => (
            <button
              key={fix.kind}
              type="button"
              onClick={() => onFix(fix)}
              className={cn(
                "font-body numeric min-h-11 cursor-pointer rounded-md px-3 text-xs font-bold",
                i === 0 ? "bg-accent text-on-accent" : "bg-raised text-text",
              )}
            >
              {label(fix)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
