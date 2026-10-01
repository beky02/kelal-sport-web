"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { routes } from "@/config/routes";

/**
 * The way into a fixture's full book.
 *
 * A real link, not a button: middle-click, open-in-new-tab and the status bar
 * all work, and the count tells the user whether it is worth the trip.
 */
export function MoreMarketsLink({
  eventId,
  marketCount,
}: {
  eventId: string;
  marketCount: number;
}) {
  const t = useTranslation();

  return (
    <Link
      href={routes.event(eventId)}
      aria-label={t.t("board.moreMarketsAria", { n: marketCount })}
      className="border-divider text-muted hover:bg-raised hover:text-text flex items-center justify-center gap-px border-t text-xs font-bold no-underline md:border-t-0 md:border-l"
    >
      <span className="py-2 md:py-0">
        {t.t("board.moreMarkets", { n: marketCount })}
      </span>
      <ChevronRight size={12} strokeWidth={2} aria-hidden />
    </Link>
  );
}
