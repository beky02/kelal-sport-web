"use client";

import Link from "next/link";
import { Menu, ShieldCheck, UserRound, Wallet } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Button, IconButton } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { routes } from "@/config/routes";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSession } from "@/features/auth/hooks/use-session";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { HeaderSearch } from "@/features/search/components/HeaderSearch";
import { useWallet } from "@/features/wallet/hooks/use-wallet";
import { LANG_LABEL } from "@/lib/i18n";
import { useUiStore } from "@/stores/ui.store";
import type { Lang } from "@/types/common";
import { BrandMark } from "./BrandMark";
import { MainNav } from "./MainNav";

const LANG_OPTIONS = [
  { value: "en", label: LANG_LABEL.en },
  { value: "am", label: LANG_LABEL.am },
] as const satisfies ReadonlyArray<{ value: Lang; label: string }>;

/**
 * The application bar.
 *
 * Language sits here rather than buried in settings: this is a bilingual product
 * and a user who lands in the wrong script needs one tap, not a menu. Balance and
 * Deposit are adjacent because that is the sequence people follow.
 *
 * On a phone it is only brand, language and money: navigation moves to the tab
 * bar at the foot of the screen (`MobileTabBar`), Deposit is one tap away inside
 * the wallet, and the profile is the tab bar's Menu.
 */
export function AppHeader() {
  const t = useTranslation();

  const lang = useUiStore((s) => s.lang);
  const setLang = useUiStore((s) => s.setLang);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);

  const { isLoading, isGuest } = useSession();
  const openAuth = useAuthStore((s) => s.open);
  const wallet = useWallet(!isLoading && !isGuest);

  return (
    <header className="bg-surface border-divider sticky top-0 z-30 flex h-[52px] items-center gap-2 px-3 md:h-14 md:gap-3.5 md:border-b md:px-5">
      {/* Tablet only: a phone browses sports from the tabs on the board, and a
          desktop has the sidebar itself. */}
      <IconButton
        label={t.t("sidebar.sports")}
        onClick={() => setSidebarOpen(true)}
        className="hidden bg-transparent md:grid lg:hidden"
      >
        <Menu size={18} strokeWidth={1.5} aria-hidden />
      </IconButton>

      <BrandMark />
      <MainNav />

      <span className="flex-1" />

      <HeaderSearch />

      <Link
        href={routes.responsibleGaming}
        className="text-muted hover:text-text hidden h-9 items-center gap-1.5 px-1.5 text-xs font-semibold no-underline lg:flex"
      >
        <ShieldCheck size={15} strokeWidth={1.5} aria-hidden />
        {t.t("header.responsibleGaming")}
      </Link>

      {/* Two sizes of one control rather than one squeezed: at 375px a guest's
          Log in and Register only fit beside the phone's smaller pills. */}
      <Segmented<Lang>
        value={lang}
        onChange={setLang}
        size="xs"
        fill="ground"
        className="md:hidden"
        options={LANG_OPTIONS}
      />
      <Segmented<Lang>
        value={lang}
        onChange={setLang}
        size="sm"
        className="hidden md:flex"
        options={LANG_OPTIONS}
      />

      {isLoading ? (
        // Until /api/me answers, neither a guest's buttons nor a player's
        // balance: the one thing worse than a moment's blank is a flash of the
        // wrong state.
        <>
          <Skeleton className="h-[34px] w-[88px] rounded-md md:h-9 md:w-[120px]" />
          <span role="status" className="sr-only">
            {t.t("header.accountLoading")}
          </span>
        </>
      ) : isGuest ? (
        <>
          <Button
            className="h-[34px] px-2.5 md:h-9 md:px-4"
            onClick={() => openAuth("login")}
          >
            {t.t("header.login")}
          </Button>
          <Button
            variant="primary"
            className="h-[34px] px-2.5 md:h-9 md:px-4"
            onClick={() => openAuth("register")}
          >
            {t.t("header.register")}
          </Button>
        </>
      ) : (
        <>
          <Link
            href={routes.wallet}
            aria-label={
              wallet.data
                ? t.t("header.walletBalance", {
                    amount: t.money(wallet.data.balance),
                  })
                : t.t("nav.wallet")
            }
            className="bg-raised text-text numeric flex h-[34px] shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-bold no-underline md:h-9 md:px-3"
          >
            <Wallet
              size={15}
              strokeWidth={1.5}
              aria-hidden
              className="md:hidden"
            />
            {wallet.data ? t.number(wallet.data.balance) : "—"}
            <span className="text-muted text-[10px] font-semibold">
              {t.t("header.currency")}
            </span>
          </Link>
          <Link
            href={routes.walletAction("deposit")}
            className="border-accent text-text font-body hidden h-9 items-center rounded-md border px-4 text-[13px] font-bold no-underline md:flex"
          >
            {t.t("header.deposit")}
          </Link>
          <Link
            href={routes.profile}
            aria-label={t.t("header.profile")}
            className="bg-raised text-text hidden size-9 shrink-0 place-items-center rounded-md no-underline md:grid"
          >
            <UserRound size={16} strokeWidth={1.5} aria-hidden />
          </Link>
        </>
      )}
    </header>
  );
}
