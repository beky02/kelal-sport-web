"use client";

import { useRouter } from "next/navigation";
import { Lock, WifiOff } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { routes } from "@/config/routes";
import { useBreak } from "@/features/responsible-gaming/hooks/use-responsible-gaming";
import { useLongDateTimeText } from "@/lib/i18n/use-long-date-time-text";
import { useIsOnline } from "@/stores/system.store";

/**
 * Sits under the header while the connection is down.
 *
 * Says the thing that actually matters — the prices may be stale — rather than
 * just "offline". Full width and in the loss tint because it changes whether the
 * page can be trusted.
 */
export function OfflineBanner() {
  const t = useTranslation();
  const online = useIsOnline();

  if (online) return null;

  return (
    <div
      role="status"
      className="bg-loss-bg text-text flex min-h-10 items-center gap-2.5 px-5 py-1 text-[13px]"
    >
      <WifiOff
        size={16}
        strokeWidth={1.5}
        aria-hidden
        className="text-loss shrink-0"
      />
      <span className="flex-1">
        <b>{t.t("system.offlineTitle")}</b> {t.t("system.offlineBody")}
      </span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="bg-raised text-text font-body h-8 cursor-pointer rounded-md px-3.5 text-xs font-bold"
      >
        {t.t("system.retry")}
      </button>
    </div>
  );
}

/**
 * Shown above the board while a responsible-gaming break is running, as
 * `/api/me` reports it — so a reload brings it straight back.
 *
 * Accent-bordered rather than red: a break is the user's own decision being
 * honoured, not a fault. It states when it ends (a permanent self-exclusion
 * has no end) and links to the limits, and there is deliberately no way to
 * dismiss it.
 */
export function CoolOffBanner() {
  const t = useTranslation();
  const router = useRouter();
  const pause = useBreak();
  const endText = useLongDateTimeText();
  const online = useIsOnline();

  // The offline banner already says betting is paused; two would be noise.
  if (pause === null || !online) return null;

  return (
    <div
      role="status"
      className="border-accent bg-surface flex items-center gap-3 rounded-lg border py-2.5 pr-2.5 pl-3.5"
    >
      <Lock
        size={18}
        strokeWidth={1.5}
        aria-hidden
        className="text-accent shrink-0"
      />
      <span className="flex-1 text-[13px]">
        {pause.until ? (
          <>
            <b>{t.t("system.coolOffTitle", { until: endText(pause.until) })}</b>{" "}
            {t.t("system.coolOffBody")}
          </>
        ) : (
          <>
            <b>{t.t("system.excludedTitle")}</b> {t.t("system.excludedBody")}
          </>
        )}
      </span>
      <button
        type="button"
        onClick={() => router.push(routes.responsibleGaming)}
        className="border-divider text-text font-body h-8.5 cursor-pointer rounded-md border bg-transparent px-3.5 text-xs font-bold"
      >
        {t.t("system.viewLimits")}
      </button>
    </div>
  );
}
