"use client";

import { useTranslation } from "@/lib/i18n/use-translation";
import { Card } from "@/components/ui/Card";
import { OddsButton } from "@/features/odds/components/OddsButton";
import type { Market } from "../types";
import type { Localized } from "@/types/common";

/**
 * One market's full set of prices.
 *
 * Lined markets (over/under, handicap) put the line in a leading column and
 * label each button, because "2.65" means nothing without "Over 3.5" beside it.
 */
export function MarketCard({
  market,
  eventName,
}: {
  market: Market;
  eventName: Localized;
}) {
  const lined = market.line !== null;

  return (
    <div
      className={
        lined
          ? "grid grid-cols-[52px_minmax(0,1fr)] items-center gap-2"
          : "grid grid-cols-1 gap-2"
      }
    >
      {lined && (
        <span className="text-muted numeric text-center text-[13px] font-bold">
          {market.line}
        </span>
      )}
      {/* Three across at most: a market with fifteen outcomes (correct score)
          wraps onto rows rather than shrinking every button to nothing. */}
      <div
        className="grid gap-1.5"
        style={{
          gridTemplateColumns: `repeat(${Math.min(market.outcomes.length, 3)}, minmax(0,1fr))`,
        }}
      >
        {market.outcomes.map((outcome) => (
          <OddsButton
            key={outcome.id}
            market={market}
            outcome={outcome}
            eventName={eventName}
            showLabel={
              market.type !== "1x2" &&
              market.type !== "ml" &&
              market.type !== "dc"
            }
          />
        ))}
      </div>
    </div>
  );
}

/** A named group of markets sharing a type, e.g. every over/under line. */
export function MarketGroupCard({
  title,
  markets,
  eventName,
}: {
  title: string;
  markets: Market[];
  eventName: Localized;
}) {
  const t = useTranslation();

  return (
    <Card className="flex flex-col gap-2.5 p-3">
      <h3 className="text-[15px]">{title}</h3>
      {markets.map((market) => (
        <MarketCard key={market.id} market={market} eventName={eventName} />
      ))}
      {markets.every((m) => m.status === "suspended") && (
        <p className="text-muted text-[11px]">{t.t("board.suspendedHint")}</p>
      )}
    </Card>
  );
}
