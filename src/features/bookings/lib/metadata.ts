import type { Metadata } from "next";
import { translate } from "@/lib/i18n";
import { pickLocale, type Lang } from "@/types/common";
import type { BookingLookup } from "../types";

/**
 * The `/b/{code}` page's title and Open Graph tags — what Telegram shows when
 * the link is shared. In one language: the page's (the tenant's default until
 * the language is in the URL, FD2).
 */
export function bookingMetadata(
  lookup: BookingLookup,
  {
    lang,
    siteName,
    url,
    bookingCodes = true,
  }: {
    lang: Lang;
    /** The tenant's brand; null when config could not be read — no other brand stands in. */
    siteName: string | null;
    /** The canonical link, absolute. */
    url: string;
    /** The tenant's switch: off, the page is a 404 and says nothing of a booking. */
    bookingCodes?: boolean;
  },
): Metadata {
  // Codes expire within days and are passed hand to hand; they are not pages
  // anyone should find by searching.
  const robots = { index: false, follow: false };
  if (!bookingCodes) return { robots };
  const titled = (title: string) =>
    siteName ? `${title} · ${siteName}` : title;
  const site = siteName ? { siteName } : {};
  const code = lookup.status === "ok" ? lookup.booking.code : lookup.code;

  switch (lookup.status) {
    case "failed":
      // A passing fault. Link-preview bots cache the first answer they get,
      // so nothing here may say the booking failed: a neutral title, no card.
      return {
        title: titled(translate(lang, "booking.pageTitle", { code })),
        robots,
      };
    case "expired":
    case "not_found": {
      const title = translate(
        lang,
        lookup.status === "expired"
          ? "booking.og.expired"
          : "booking.og.notFound",
      );
      return {
        title: titled(title),
        description: title,
        robots,
        openGraph: { title, description: title, url, type: "website", ...site },
      };
    }
    case "ok": {
      // Only what the code can still put in a slip.
      const picks = [
        ...new Set(
          lookup.booking.legs
            .filter((leg) => leg.unavailable === null && leg.eventName)
            .map((leg) => pickLocale(leg.eventName!, lang)),
        ),
      ];
      const title = translate(lang, "booking.pageTitle", { code });
      const description = translate(lang, "booking.og.description", {
        picks: picks.length ? picks.join(" · ") : code,
      });
      return {
        title: titled(title),
        description,
        robots,
        openGraph: { title, description, url, type: "website", ...site },
      };
    }
  }
}
