"use client";

import { CardLabel } from "@/components/ui/Card";
import { BookingAlert } from "@/features/bet-slip/components/BookingCode";
import { useBetSlipStore } from "@/features/bet-slip/stores/bet-slip.store";
import { useDateTimeText } from "@/lib/i18n/use-date-time-text";
import { useTranslation } from "@/lib/i18n/use-translation";
import { compareOdds } from "@/lib/money";
import { cn } from "@/lib/utils/cn";
import { useUiStore } from "@/stores/ui.store";
import type { Localized } from "@/types/common";
import { Loader2 } from "lucide-react";
import { useLoadBooking } from "../hooks/use-bookings";
import { stakeHintOf } from "../lib/to-slip";
import { useValidUntil } from "../hooks/use-valid-until";
import { bookingErrorMessage } from "../lib/errors";
import type { Booking, BookingLeg } from "../types";
import { ASIDE_QUERY } from "@/lib/utils/use-media-query";

/**
 * The `/b/{code}` page: a shared booking, re-priced now, and the one action
 * that matters — put it in the slip.
 *
 * Server-rendered from the booking, so a link preview and a slow phone both
 * see the selections at once. Loading fetches the booking again: the page may
 * have been open a while, and the slip takes the odds of the moment.
 */
export function BookingView({ booking: rendered }: { booking: Booking }) {
  const t = useTranslation();
  const validUntil = useValidUntil();
  const inSlip = useBetSlipStore((s) => s.selections.length);
  const setAsidePanel = useUiStore((s) => s.setAsidePanel);
  const setMobileSlipOpen = useUiStore((s) => s.setMobileSlipOpen);

  const openSlip = () => {
    setAsidePanel("slip");
    // On a phone or tablet the slip is a sheet: open it to show what loaded.
    if (
      typeof window.matchMedia === "function" &&
      !window.matchMedia(ASIDE_QUERY).matches
    ) {
      setMobileSlipOpen(true);
    }
  };
  const load = useLoadBooking(openSlip);
  // After a load the page shows what was fetched then, so it never shows
  // older odds beside the slip than the slip has.
  const booking = load.data ?? rendered;
  const loadable = booking.legs.some((leg) => leg.unavailable === null);
  const stakeHint = stakeHintOf(booking);
  // Once it is in the slip, the action is to look at it — not to load it again
  // over whatever the player has changed since.
  const loaded = load.isSuccess && loadable;
  const failure = load.isError
    ? bookingErrorMessage(load.error, booking.code)
    : null;

  return (
    <div className="flex flex-col">
      <div className="border-divider flex flex-col gap-1 border-b px-4 py-3.5">
        <h1 className="font-display text-xl leading-tight">
          {t.t("booking.pageTitle", { code: booking.code })}
        </h1>
        <p className="text-muted text-xs">{validUntil(booking.expiresAt)}</p>
      </div>

      <CardLabel className="px-4 pt-3">{t.t("booking.selections")}</CardLabel>
      <ul className="flex flex-col">
        {booking.legs.map((leg) => (
          <BookingLegRow key={leg.outcomeId} leg={leg} />
        ))}
      </ul>

      {stakeHint && (
        <div className="border-divider flex items-baseline justify-between gap-2 border-t px-4 py-3">
          <span className="text-muted">{t.t("booking.stakeHint")}</span>
          <span className="font-bold">{t.money(stakeHint)}</span>
        </div>
      )}

      <div className="flex flex-col gap-2 px-4 pt-1 pb-4">
        {failure && (
          <BookingAlert>{t.t(failure.key, failure.values)}</BookingAlert>
        )}
        {inSlip > 0 && !load.isSuccess && (
          <p className="text-muted text-xs">{t.t("booking.replacesSlip")}</p>
        )}
        {load.isSuccess && (
          <p
            role="status"
            className={cn(
              "text-xs font-semibold",
              loaded ? "text-win" : "text-muted",
            )}
          >
            {t.t(loaded ? "booking.loaded" : "booking.nothingAdded", {
              code: booking.code,
            })}
          </p>
        )}
        <button
          type="button"
          // Announced as off but kept focusable — while it asks, and when a
          // fresh read finds nothing left to load — so focus isn't lost.
          aria-disabled={load.isPending || !loadable}
          aria-busy={load.isPending}
          onClick={() => {
            if (loaded) openSlip();
            else if (!load.isPending && loadable) load.mutate(booking.code);
          }}
          className="bg-accent text-on-accent font-body flex h-12 cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-bold aria-disabled:cursor-not-allowed aria-disabled:opacity-45"
        >
          {load.isPending && (
            <Loader2 size={16} className="animate-spin" aria-hidden />
          )}
          {t.t(loaded ? "booking.openSlip" : "booking.loadIntoSlip")}
        </button>
      </div>
    </div>
  );
}

function BookingLegRow({ leg }: { leg: BookingLeg }) {
  const t = useTranslation();
  const dateTime = useDateTimeText();
  const name = (value: Localized | null) => (value ? t.pick(value) : "");
  const moved =
    leg.odds && leg.oddsAtCode ? compareOdds(leg.odds, leg.oddsAtCode) : 0;

  return (
    <li className="border-divider flex items-center gap-3 border-t px-4 py-2.5 first:border-t-0">
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{name(leg.eventName)}</div>
        <div className="text-muted flex flex-wrap gap-x-1.5 text-xs">
          <span>{name(leg.marketName)}</span>
          <span aria-hidden>·</span>
          <span>{name(leg.outcomeName)}</span>
          {leg.startTime && (
            <>
              <span aria-hidden>·</span>
              <span>{dateTime(leg.startTime)}</span>
            </>
          )}
        </div>
      </div>
      {leg.unavailable === null && leg.odds ? (
        <div className="flex shrink-0 flex-col items-end">
          <span
            className={cn(
              "flex items-center gap-1 font-bold",
              moved > 0 && "text-win",
              moved < 0 && "text-loss",
            )}
          >
            {moved !== 0 && (
              <span aria-hidden className="text-[8px] leading-none">
                {moved > 0 ? "▲" : "▼"}
              </span>
            )}
            <span>{t.odds(leg.odds)}</span>
          </span>
          {moved !== 0 && leg.oddsAtCode && (
            <span className="text-muted text-[11px]">
              {t.t("booking.wasOdds", { odds: t.odds(leg.oddsAtCode) })}
            </span>
          )}
        </div>
      ) : (
        <span className="bg-loss-bg text-loss shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold">
          {t.t(`booking.reason.${leg.unavailable ?? "UNPRICED"}`)}
        </span>
      )}
    </li>
  );
}
