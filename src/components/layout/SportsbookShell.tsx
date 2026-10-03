"use client";

import { AuthDialog } from "@/features/auth/components/AuthDialog";
import { SessionWatcher } from "@/features/auth/hooks/use-session";
import { MobileBetSlip } from "@/features/bet-slip/components/MobileBetSlip";
import { NetworkWatcher } from "@/features/system/hooks/use-online-status";
import {
  CoolOffBanner,
  OfflineBanner,
} from "@/features/system/components/StatusBanners";
import { SystemOverlays } from "@/features/system/components/SystemOverlays";
import { DepositFollower } from "@/features/wallet/components/DepositFollower";
import { AppFooter } from "./AppFooter";
import { AsidePanel } from "./AsidePanel";
import { AppHeader } from "./AppHeader";
import { MobileTabBar } from "./MobileTabBar";
import { Sidebar } from "./Sidebar";
import { SidebarDrawer } from "./SidebarDrawer";

/**
 * The sportsbook layout.
 *
 *   ≥ 1440px   sidebar 248 · board (fluid) · slip 340
 *   1280–1439  sidebar 228 · board (fluid) · slip 312
 *   1024–1279  sidebar 228 · board (fluid)        — slip becomes a sheet
 *   768–1023   board only                        — sidebar becomes a drawer
 *   < 768      board only, tab bar at the foot   — the phone app
 *
 * Only the middle column is fluid. The sidebar and slip have jobs that do not
 * get easier with more width, and prices should not be asked to reflow.
 */
export function SportsbookShell({
  live = false,
  phoneSubheader,
  children,
}: {
  live?: boolean;
  /**
   * Full-bleed chrome under the app bar on a phone only — the sport tabs on the
   * board. Wider screens have the sidebar for the same job.
   */
  phoneSubheader?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <NetworkWatcher />
      <SessionWatcher />
      <DepositFollower />
      <AppHeader />
      <OfflineBanner />
      {phoneSubheader && <div className="md:hidden">{phoneSubheader}</div>}

      <div
        className={[
          "grid flex-1 items-start gap-3 p-3",
          // Bounded ranges, not a cascade. Tailwind emits a custom breakpoint
          // before the built-in ones, so overlapping `lg:` / `xl:` / `wide:`
          // rules would be decided by source order rather than by width. Making
          // each band exclusive takes ordering out of it.
          "lg:max-xl:grid-cols-[228px_minmax(0,1fr)]",
          "xl:max-wide:grid-cols-[228px_minmax(0,1fr)_312px]",
          "wide:grid-cols-[248px_minmax(0,1fr)_340px]",
        ].join(" ")}
      >
        <aside className="hidden lg:block">
          <Sidebar live={live} />
        </aside>

        <main className="flex min-w-0 flex-col gap-2.5">
          <CoolOffBanner />
          {children}
        </main>

        <aside className="bg-surface border-border sticky top-[68px] hidden overflow-hidden rounded-lg border xl:block">
          <AsidePanel />
        </aside>
      </div>

      <AppFooter />
      {/* Room for the fixed tab bar, so it never sits over the licence. */}
      <div
        aria-hidden
        className="h-[calc(60px+env(safe-area-inset-bottom))] shrink-0 md:hidden"
      />

      <MobileTabBar />

      <SidebarDrawer live={live} />
      <MobileBetSlip />
      <AuthDialog />
      <SystemOverlays />
    </>
  );
}
