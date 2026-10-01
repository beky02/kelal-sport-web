"use client";

import { X } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useBetSlipStore } from "@/features/bet-slip/stores/bet-slip.store";
import type { Localized } from "@/types/common";

/**
 * After a code is loaded: which one, and what could not come with it. A
 * started match is reported, never quietly dropped, so the player knows the
 * slip is not quite the one they were sent.
 */
export function BookingNotice() {
  const t = useTranslation();
  const notice = useBetSlipStore((s) => s.bookingNotice);
  const dismiss = useBetSlipStore((s) => s.dismissBookingNotice);
  if (!notice) return null;

  const name = (value: Localized | null) => (value ? t.pick(value) : "");

  return (
    <div
      role="status"
      data-testid="booking-notice"
      className="bg-surface border-border mx-3 mb-2.5 flex items-start gap-2 rounded-md border py-1 pr-1 pl-3"
    >
      <div className="min-w-0 flex-1 py-2">
        <p className="font-bold">
          {t.t("booking.loaded", { code: notice.code })}
        </p>
        {notice.notAdded.length > 0 && (
          <>
            <p className="text-muted mt-1 text-xs">
              {t.t("booking.notAddedTitle")}
            </p>
            <ul className="mt-0.5 flex flex-col gap-0.5 text-xs">
              {notice.notAdded.map((leg) => (
                <li key={leg.outcomeId}>
                  {t.t("booking.notAddedLeg", {
                    event: name(leg.eventName),
                    pick: name(leg.outcomeName),
                    reason: t.t(
                      `booking.reason.${leg.unavailable ?? "NOT_FOUND"}`,
                    ),
                  })}
                </li>
              ))}
            </ul>
          </>
        )}
        {notice.systemSizes && (
          <p className="text-muted mt-1 text-xs">
            {t.t("booking.sizesNote", {
              sizes: notice.systemSizes.join(", "),
              k: notice.systemSizes[0],
            })}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t.t("booking.dismiss")}
        className="text-muted grid size-11 shrink-0 cursor-pointer place-items-center rounded-md"
      >
        <X size={16} strokeWidth={1.5} aria-hidden />
      </button>
    </div>
  );
}
