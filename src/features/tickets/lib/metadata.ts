import type { Metadata } from "next";
import { STATUS_KEY } from "@/features/bets/lib/labels";
import { translate } from "@/lib/i18n";
import { pickLocale, type Lang } from "@/types/common";
import type { TicketLookup } from "../types";

/**
 * The `/t/{ticket}` page's title and Open Graph tags — what Telegram shows when
 * a ticket is shared. In one language: the page's (the tenant's default until
 * the language is in the URL, FD2). The status and the matches, never an
 * amount: a link preview is seen by a whole chat, the page by whoever opens it.
 */
export function ticketMetadata(
  lookup: TicketLookup,
  {
    lang,
    siteName,
    url,
  }: {
    lang: Lang;
    /** The tenant's brand; null when config could not be read — no other brand stands in. */
    siteName: string | null;
    /** The canonical link, absolute. */
    url: string;
  },
): Metadata {
  // Tickets are passed hand to hand; they are not pages to find by searching.
  const robots = { index: false, follow: false };
  const titled = (title: string) =>
    siteName ? `${title} · ${siteName}` : title;
  const site = siteName ? { siteName } : {};

  switch (lookup.status) {
    case "failed":
      // A passing fault. Link-preview bots cache the first answer they get,
      // so nothing here may say the check failed: a neutral title, no card.
      return {
        title: titled(
          translate(lang, "ticket.pageTitle", { ticket: lookup.ticketId }),
        ),
        robots,
      };
    case "not_found": {
      const title = translate(lang, "ticket.og.notFound");
      return {
        title: titled(title),
        description: title,
        robots,
        openGraph: { title, description: title, url, type: "website", ...site },
      };
    }
    case "ok": {
      const { ticket } = lookup;
      const matches = [
        ...new Set(ticket.legs.map((leg) => pickLocale(leg.match, lang))),
      ];
      const title = translate(lang, "ticket.pageTitle", {
        ticket: ticket.ticketId,
      });
      const description = translate(lang, "ticket.og.description", {
        status: translate(lang, STATUS_KEY[ticket.status]),
        matches: matches.join(" · "),
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
