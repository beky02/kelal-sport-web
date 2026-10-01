"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, Menu, Radio, Ticket } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { SportIcon } from "@/components/ui/SportIcon";
import { features } from "@/config/features";
import { routes } from "@/config/routes";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { useBetSlipStore } from "@/features/bet-slip/stores/bet-slip.store";
import { useLiveEventCount } from "@/features/sports/hooks/use-sports";
import { useSessionStore } from "@/stores/session.store";
import { useUiStore } from "@/stores/ui.store";
import { cn } from "@/lib/utils/cn";

/** The ball that stands for "Sports" as a whole, not for soccer in particular. */
const SPORTS_GLYPH = [
  "M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20",
  "m12 7 4.5 3.3-1.7 5.2H9.2l-1.7-5.2z",
  "M12 2v5",
  "m21.5 9.5-5 .8",
  "m2.5 9.5 5 .8",
  "m18 20-3.2-4.5",
  "m6 20 3.2-4.5",
];

type Tab = "sports" | "live" | "bets" | "menu";

/**
 * Which tab a page belongs to. The wallet belongs to none: it is reached from
 * the balance in the app bar, and lighting up a tab for it would be a lie.
 */
function tabFor(pathname: string): Tab | null {
  if (pathname.startsWith(routes.live)) return "live";
  if (
    pathname.startsWith(routes.myBets) ||
    pathname.startsWith(routes.transactions)
  )
    return "bets";
  if (
    pathname.startsWith(routes.profile) ||
    pathname.startsWith(routes.responsibleGaming)
  )
    return "menu";
  if (pathname.startsWith(routes.wallet)) return null;
  return "sports";
}

const ITEM =
  "font-body flex min-w-0 cursor-pointer flex-col items-center justify-center gap-[3px] text-[10px] font-bold no-underline";

/**
 * The phone's navigation: five tabs pinned to the foot of the screen, where a
 * thumb already is.
 *
 * The slip sits in the middle, raised, because it is the one thing on this bar
 * that holds unfinished work. Its count is always shown — zero included — so
 * the button reads as the slip before anything has been added to it.
 */
export function MobileTabBar() {
  const t = useTranslation();
  const pathname = usePathname();
  const active = tabFor(pathname);

  const liveCount = useLiveEventCount();
  const selectionCount = useBetSlipStore((s) => s.selections.length);
  const openSlip = useUiStore((s) => s.setMobileSlipOpen);
  const isGuest = useSessionStore((s) => s.isGuest);
  const openAuth = useAuthStore((s) => s.open);

  const tone = (tab: Tab) => (active === tab ? "text-accent" : "text-muted");

  return (
    <nav
      className={cn(
        "bg-surface border-divider fixed inset-x-0 bottom-0 z-30 grid h-[calc(60px+env(safe-area-inset-bottom))] border-t pb-[env(safe-area-inset-bottom)] md:hidden",
        // Four tabs until live betting ships (Release 2).
        features.live ? "grid-cols-5" : "grid-cols-4",
      )}
    >
      <Link
        href={routes.home}
        aria-current={active === "sports" ? "page" : undefined}
        className={cn(ITEM, tone("sports"))}
      >
        <SportIcon paths={SPORTS_GLYPH} size={21} />
        {t.t("nav.sports")}
      </Link>

      {features.live && (
        <Link
          href={routes.live}
          aria-current={active === "live" ? "page" : undefined}
          className={cn(ITEM, tone("live"))}
        >
          <span className="relative grid">
            <Radio size={21} strokeWidth={1.5} aria-hidden />
            {liveCount > 0 && (
              <span className="bg-live absolute -top-1 -right-3 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-extrabold text-white">
                {liveCount}
              </span>
            )}
          </span>
          {t.t("nav.live")}
        </Link>
      )}

      <button
        type="button"
        aria-label={t.t("nav.slipAria", { n: selectionCount })}
        onClick={() => openSlip(true)}
        className={cn(ITEM, "text-text gap-0.5 bg-transparent")}
      >
        {/* Lifted out of the bar, with a ring in the bar's colour so it reads
            as sitting on top of it rather than cut into it. */}
        <span className="bg-accent text-on-accent relative -mt-3.5 grid h-9 w-11 place-items-center rounded-[12px] shadow-[0_0_0_3px_var(--color-surface)]">
          <Ticket size={20} strokeWidth={1.6} aria-hidden />
          <span className="bg-text text-ground absolute -top-1.5 -right-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-extrabold">
            {selectionCount}
          </span>
        </span>
        {t.t("nav.betSlip")}
      </button>

      <Link
        href={routes.myBets}
        aria-current={active === "bets" ? "page" : undefined}
        onClick={(event) => {
          // Nothing to show a guest here — ask them to log in instead.
          if (isGuest) {
            event.preventDefault();
            openAuth("login");
          }
        }}
        className={cn(ITEM, tone("bets"))}
      >
        <ClipboardCheck size={21} strokeWidth={1.5} aria-hidden />
        {t.t("nav.myBets")}
      </Link>

      <Link
        href={routes.profile}
        aria-current={active === "menu" ? "page" : undefined}
        className={cn(ITEM, tone("menu"))}
      >
        <Menu size={21} strokeWidth={1.5} aria-hidden />
        {t.t("nav.menu")}
      </Link>
    </nav>
  );
}
