"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n/use-translation";
import { LICENCE } from "@/config/constants";
import { routes } from "@/config/routes";
import type { MessageKey } from "@/lib/i18n";

const LINKS: Array<{ label: MessageKey; href: string }> = [
  { label: "footer.terms", href: routes.terms },
  { label: "footer.privacy", href: routes.privacy },
  { label: "footer.responsibleGaming", href: routes.responsibleGaming },
  { label: "footer.help", href: routes.help },
  { label: "footer.telegram", href: routes.telegram },
];

/**
 * Licence, age limit, helpline and the statutory links.
 *
 * Page-level rather than tucked in the sidebar, so it is present on the account
 * and wallet screens too — a regulated product has to carry this everywhere, and
 * the helpline in particular should never be more than a glance away.
 */
export function AppFooter() {
  const t = useTranslation();

  return (
    <FooterBar>
      <FooterNotices />

      <span className="flex-1" />

      <nav aria-label="Footer" className="flex flex-wrap gap-x-[18px] gap-y-2">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-muted hover:text-text font-semibold no-underline"
          >
            {t.t(link.label)}
          </Link>
        ))}
      </nav>
    </FooterBar>
  );
}

/** The footer's frame: the player's, and the shop kiosk's (F8ca). */
export function FooterBar({ children }: { children: React.ReactNode }) {
  return (
    <footer className="bg-surface border-divider text-muted flex flex-wrap items-center gap-x-5 gap-y-3 border-t px-5 py-3.5 text-xs">
      {children}
    </footer>
  );
}

/**
 * The licence, the age limit and the helpline, on every page of both sites
 * (SRS RG-05). The kiosk shows them without the links, whose pages a terminal
 * host doesn't serve.
 */
export function FooterNotices() {
  const t = useTranslation();

  return (
    <>
      <div className="flex items-center gap-2.5">
        <div className="bg-raised text-text flex h-9 w-[50px] shrink-0 flex-col items-center justify-center rounded-lg">
          <span className="font-display text-sm leading-none">ELS</span>
          <span className="text-[7px] font-bold tracking-[0.12em]">
            LICENSED
          </span>
        </div>
        <span>{t.t("sidebar.licence")}</span>
      </div>

      <span className="flex items-center gap-2">
        <span className="border-text text-text rounded-[4px] border-[1.5px] px-[5px] font-bold">
          {LICENCE.minimumAge}+
        </span>
        {t.t("sidebar.playResponsibly")}
      </span>

      <span>{t.t("footer.helpline")}</span>
    </>
  );
}
