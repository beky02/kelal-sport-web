"use client";

import { useTranslation } from "@/lib/i18n/use-translation";
import type { MessageKey } from "@/lib/i18n";
import type { AuthErrorView } from "../lib/errors";

const FIX_LABEL: Record<NonNullable<AuthErrorView["fix"]>, MessageKey> = {
  logInAgain: "auth.logInAgain",
};

/**
 * A refusal, in the form, where the player is looking. Announced as an alert
 * so a screen reader hears it without hunting; when there is something to do
 * about it, the action is right there.
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
      className="bg-loss-bg text-text flex flex-col gap-2 rounded-md px-3 py-2.5 text-[13px]"
    >
      <span>{error.detail ? `${message} ${error.detail}` : message}</span>
      {error.fix && onFix && (
        <button
          type="button"
          onClick={onFix}
          className="text-accent cursor-pointer self-start bg-transparent font-semibold"
        >
          {t.t(FIX_LABEL[error.fix])}
        </button>
      )}
    </div>
  );
}
