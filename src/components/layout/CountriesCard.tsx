"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Card, CardLabel } from "@/components/ui/Card";
import { Flag } from "@/components/ui/Flag";
import { SidebarRow, RowCount } from "@/components/layout/SidebarRow";
import { useCountries } from "@/features/competitions/hooks/use-competitions";
import { useSportsbookChrome } from "@/features/sportsbook/chrome";

/** Countries, each expanding to its leagues. */
export function CountriesCard() {
  const t = useTranslation();
  const { data: countries } = useCountries();
  const [expanded, toggle] = useSportsbookChrome().useExpandedCountries();

  return (
    <Card className="p-1.5">
      <CardLabel>{t.t("sidebar.countries")}</CardLabel>

      {countries?.map((country) => {
        const open = expanded[country.code] === true;
        const total = country.leagues.reduce((n, l) => n + l.eventCount, 0);

        return (
          <div key={country.code}>
            <SidebarRow
              aria-expanded={open}
              onClick={() => toggle(country.code)}
            >
              <Flag src={country.flag} />
              <span className="flex-1 truncate">{t.pick(country.name)}</span>
              <RowCount>{total}</RowCount>
              {open ? (
                <ChevronUp size={14} className="text-muted" aria-hidden />
              ) : (
                <ChevronDown size={14} className="text-muted" aria-hidden />
              )}
            </SidebarRow>

            {open &&
              country.leagues.map((league) => (
                <div
                  key={league.id}
                  className="flex min-h-8 items-center justify-between pr-[34px] pl-10 text-[13px]"
                >
                  <span className="truncate">{t.pick(league.name)}</span>
                  <RowCount>{league.eventCount}</RowCount>
                </div>
              ))}
          </div>
        );
      })}
    </Card>
  );
}
