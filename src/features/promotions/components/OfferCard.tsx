"use client";

import { useCallback } from "react";
import { TicketPercent } from "lucide-react";
import { formatLongDate, toEat } from "@/lib/i18n/dates";
import { useLocale } from "@/lib/i18n/locale";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useUiStore } from "@/stores/ui.store";
import type { Promotion } from "../types";

/** A day an offer runs from or to — `1 Nov 2026` in East Africa Time, in the player's calendar. */
function useDayText(): (iso: string) => string {
  const t = useTranslation();
  const { calendar } = useLocale();
  return useCallback(
    (iso: string) => formatLongDate(toEat(iso).date, t.lang, calendar),
    [t, calendar],
  );
}

/**
 * One of the tenant's offers, as the API wrote it: its image (https only, and
 * none with data saver on), title, summary, the days it runs as the API sends
 * them — nothing compared with today — whether it needs a code, and its terms
 * as text under a disclosure. The rule's own code is never shown.
 */
export function OfferCard({
  offer,
  onEnterCode,
}: {
  offer: Promotion;
  /** Takes the player to the code field; none for someone who can't redeem yet. */
  onEnterCode?: () => void;
}) {
  const t = useTranslation();
  const day = useDayText();
  const dataSaver = useUiStore((s) => s.dataSaver);

  const dates =
    offer.startsAt && offer.endsAt
      ? t.t("promotions.between", {
          from: day(offer.startsAt),
          until: day(offer.endsAt),
        })
      : offer.startsAt
        ? t.t("promotions.from", { date: day(offer.startsAt) })
        : offer.endsAt
          ? t.t("promotions.until", { date: day(offer.endsAt) })
          : null;

  return (
    <article className="bg-raised flex h-full flex-col overflow-hidden rounded-lg">
      {offer.imageUrl && !dataSaver && (
        // A fixed 16:9 box, so nothing moves when the image lands.
        <div className="bg-ground aspect-video">
          {/* The operator's CDN, at its own size: next/image would fetch it
              through this server, which has no remote patterns (plan
              decision 6). No referrer goes with it. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={offer.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="size-full object-cover"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <h3 className="font-display text-base leading-snug">{offer.title}</h3>
        <p className="text-muted text-sm">{offer.summary}</p>
        {dates && <p className="text-muted numeric text-xs">{dates}</p>}
        {offer.requiresCode && (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="border-accent text-accent inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-xs font-bold">
              <TicketPercent size={14} strokeWidth={1.5} aria-hidden />
              {t.t("promotions.needsCode")}
            </span>
            {onEnterCode && (
              <button
                type="button"
                onClick={onEnterCode}
                className="bg-surface text-text font-body min-h-11 cursor-pointer rounded-md px-3 text-xs font-bold"
              >
                {t.t("promotions.enterCode")}
              </button>
            )}
          </div>
        )}
        {offer.terms && (
          <details className="mt-auto pt-1">
            <summary className="text-accent flex min-h-11 cursor-pointer items-center text-xs font-bold">
              {t.t("promotions.terms")}
            </summary>
            {/* The API's Markdown, shown as text — never as HTML — until F7d
                picks a renderer (plan decision 5). */}
            <p className="text-muted pb-1 text-xs whitespace-pre-line">
              {offer.terms}
            </p>
          </details>
        )}
      </div>
    </article>
  );
}
