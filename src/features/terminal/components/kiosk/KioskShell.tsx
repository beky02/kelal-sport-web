"use client";

import { CountriesCard } from "@/components/layout/CountriesCard";
import { SHELL_GRID } from "@/components/layout/shell-grid";
import { SportsCard } from "@/components/layout/SportsCard";
import { TopCompetitionsCard } from "@/components/layout/TopCompetitionsCard";
import type { SportsbookShellProps } from "@/features/sportsbook/chrome";
import { useBoardFilters } from "@/features/sportsbook/hooks/use-board-filters";
import { cn } from "@/lib/utils/cn";
import { KioskHeader } from "./KioskHeader";
import { KioskMobileSlip, KioskSlip } from "./KioskSlip";

/**
 * The kiosk's frame around a sportsbook page (F8ca): the player's columns at
 * the player's widths (`SHELL_GRID`), with the kiosk's header, the player's
 * sidebar without Favourites, and the kiosk's slip. None of the player's
 * watchers: no session, wallet, reality check or realtime.
 */
export function KioskShell({
  live = false,
  phoneSubheader,
  children,
}: SportsbookShellProps) {
  return (
    <>
      <KioskHeader />
      {phoneSubheader && <div className="md:hidden">{phoneSubheader}</div>}

      <div className={cn(SHELL_GRID, "pb-20 xl:pb-3")}>
        <aside className="hidden lg:block">
          <KioskSidebar live={live} />
        </aside>

        <main className="flex min-w-0 flex-col gap-2.5">{children}</main>

        <aside className="bg-surface border-border sticky top-[68px] hidden overflow-hidden rounded-lg border xl:block">
          <KioskSlip />
        </aside>
      </div>

      <KioskMobileSlip />
    </>
  );
}

/**
 * The player's sidebar without Favourites. It alone reads the board's
 * filters, so a filter change re-renders it and not the whole frame (review
 * Q6), as the player's `Sidebar` does.
 */
function KioskSidebar({ live }: { live: boolean }) {
  const { filters, set } = useBoardFilters();
  return (
    <div className="flex flex-col gap-3">
      <TopCompetitionsCard />
      <SportsCard
        activeSlug={filters.sport}
        live={live}
        onSelect={(sport) => set({ sport })}
      />
      <CountriesCard />
    </div>
  );
}
