"use client";

import { useTranslation } from "@/lib/i18n/use-translation";
import type { MessageKey } from "@/lib/i18n";
import type { AuthErrorView, AuthFix } from "../lib/errors";

const FIX_LABEL: Record<AuthFix, MessageKey> = {
  logInAgain: "auth.logInAgain",
  logInInstead: "auth.logInInstead",
  sendNewCode: "auth.sendNewCode",
  doThisLater: "auth.doThisLater",
  responsibleGaming: "header.responsibleGaming",
};

/**
 * A refusal, in the form, where the player is looking. Announced as an alert
 * so a screen reader hears it without hunting; when there is something to do
 * about it, the action is right there. The API's own `detail` is its own
 * line, never glued into our sentence: each keeps its script and rhythm.
 */
export function AuthNotice({
  error,
  onFix,
}: {
  error: AuthErrorView | null;
  onFix?: () => void;
}) {
  const t = useTranslation();
  if (!error) return null;

  const message = error.key
    ? t.t(error.key)
    : (error.text ?? t.t("auth.errors.failed"));

  return (
    <div
      role="alert"
      className="bg-loss-bg text-text flex flex-col gap-1 rounded-md px-3 py-2.5 text-[13px]"
    >
      <span className="block">{message}</span>
      {error.detail && (
        <span className="block whitespace-pre-line">{error.detail}</span>
      )}
      {error.fix && onFix && (
        <button
          type="button"
          onClick={onFix}
          // A 44 px hit area around a one-line link, without moving the text.
          className="text-accent -my-2 flex min-h-11 cursor-pointer items-center self-start bg-transparent px-1 font-semibold"
        >
          {t.t(FIX_LABEL[error.fix])}
        </button>
      )}
    </div>
  );
}

/**
 * Good news, where the player is looking — a password just changed. A status,
 * not an alert: it is read out without interrupting.
 */
export function StatusNotice({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="status"
      className="bg-win-bg text-text rounded-md px-3 py-2.5 text-[13px]"
    >
      {children}
    </div>
  );
}
