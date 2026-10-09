"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n/use-translation";
import { CountBadge } from "@/components/ui/CountBadge";
import { features } from "@/config/features";
import { routes } from "@/config/routes";
import { useSession } from "@/features/auth/hooks/use-session";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { usePublicConfig } from "@/features/config/hooks/use-public-config";
import { useLiveEventCount } from "@/features/sports/hooks/use-sports";
import { cn } from "@/lib/utils/cn";
import type { MessageKey } from "@/lib/i18n";

interface NavLink {
  href: string;
  label: MessageKey;
  live?: boolean;
  /** Nothing to show a guest here — ask them to log in instead. */
  requiresAccount?: boolean;
}

const LINKS: NavLink[] = [
  { href: routes.home, label: "nav.sports" },
  ...(features.live
    ? [{ href: routes.live, label: "nav.live" as const, live: true }]
    : []),
  { href: routes.myBets, label: "nav.myBets", requiresAccount: true },
  { href: routes.wallet, label: "nav.wallet", requiresAccount: true },
];

/** Offers are anyone's to read; shown while the tenant runs bonuses (F7ca). */
const PROMOTIONS: NavLink = {
  href: routes.promotions,
  label: "nav.promotions",
};

export function MainNav() {
  const t = useTranslation();
  const pathname = usePathname();
  const { isGuest: guestOrPending, isLoading } = useSession();
  // Until /api/me answers, a player is not sent to log in.
  const isGuest = !isLoading && guestOrPending;
  const openAuth = useAuthStore((s) => s.open);

  const liveCount = useLiveEventCount();
  const bonuses = usePublicConfig().data?.features.bonuses ?? true;
  const links = bonuses ? [...LINKS, PROMOTIONS] : LINKS;

  return (
    <nav className="no-scrollbar ml-3 hidden self-stretch overflow-x-auto md:flex">
      {links.map((link) => {
        const active =
          link.href === routes.home
            ? pathname === routes.home
            : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            onClick={(event) => {
              if (link.requiresAccount && isGuest) {
                event.preventDefault();
                openAuth("login");
              }
            }}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 text-[13px] font-bold whitespace-nowrap no-underline",
              active
                ? "border-accent text-text"
                : "text-muted hover:text-text border-transparent",
            )}
          >
            {t.t(link.label)}
            {link.live && liveCount > 0 && (
              <CountBadge tone="live">{liveCount}</CountBadge>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
