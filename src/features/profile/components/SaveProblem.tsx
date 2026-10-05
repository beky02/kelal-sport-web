"use client";

import { isProblem } from "@/features/responsible-gaming/lib/break";
import { ApiError } from "@/lib/api/errors";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { MessageKey } from "@/lib/i18n";

/**
 * A change to the account that didn't go through, where the player made it:
 * what failed, then the API's own words when it answered with a Problem, or
 * a word about the connection when it didn't — and Try again, which sends the
 * same change. A 401 says nothing here: the session-ended dialog does.
 */
export function SaveProblem({
  title,
  error,
  onRetry,
}: {
  title: MessageKey;
  error: Error | null;
  onRetry: () => void;
}) {
  const t = useTranslation();
  if (!error) return null;
  if (error instanceof ApiError && error.status === 401) return null;
  return (
    <div
      role="alert"
      className="bg-loss-bg mx-4 my-2 flex flex-col gap-1.5 rounded-md p-3"
    >
      <p className="text-xs font-bold">{t.t(title)}</p>
      <p className="text-text/80 text-xs">
        {isProblem(error) ? error.message : t.t("profile.saveFailedBody")}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="bg-raised text-text font-body min-h-11 cursor-pointer self-start rounded-lg px-3 text-xs font-bold"
      >
        {t.t("common.retry")}
      </button>
    </div>
  );
}
