"use client";

import { CountriesCard } from "@/components/layout/CountriesCard";
import { SportsCard } from "@/components/layout/SportsCard";
import { TopCompetitionsCard } from "@/components/layout/TopCompetitionsCard";
import type { SportsbookShellProps } from "@/features/sportsbook/chrome";
import { useBoardFilters } from "@/features/sportsbook/hooks/use-board-filters";
import { KioskHeader } from "./KioskHeader";
import { KioskMobileSlip, KioskSlip } from "./KioskSlip";

/**
 * The kiosk's frame around a sportsbook page (F8ca): the player's layout —
 * the same columns at the same widths (`SportsbookShell`) — with the kiosk's
 * header, the player's sidebar without Favourites, and the kiosk's slip. None
 * of the player's watchers: no session, wallet, reality check or realtime.
 */
export function KioskShell({
  live = false,
  phoneSubheader,
  children,
}: SportsbookShellProps) {
  const { filters, set } = useBoardFilters();

  return (
    <>
      <KioskHeader />
      {phoneSubheader && <div className="md:hidden">{phoneSubheader}</div>}

      <div
        className={[
          "grid flex-1 items-start gap-3 p-3 pb-20 xl:pb-3",
          // The player's bands (SportsbookShell): bounded, not a cascade.
          "lg:max-xl:grid-cols-[228px_minmax(0,1fr)]",
          "xl:max-wide:grid-cols-[228px_minmax(0,1fr)_312px]",
          "wide:grid-cols-[248px_minmax(0,1fr)_340px]",
        ].join(" ")}
      >
        <aside className="hidden lg:block">
          <div className="flex flex-col gap-3">
            <TopCompetitionsCard />
            <SportsCard
              activeSlug={filters.sport}
              live={live}
              onSelect={(sport) => set({ sport })}
            />
            <CountriesCard />
          </div>
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
