"use client";

import { useTranslation } from "@/lib/i18n/use-translation";
import { Flag } from "@/components/ui/Flag";
import { StarButton } from "@/components/ui/StarButton";
import { cn } from "@/lib/utils/cn";
import type { Competition } from "@/features/competitions/types";
import { BOARD_GRID } from "../lib/grid";

/** A market group's caption plus its outcome codes, e.g. Match result · 1 X 2. */
function ColumnCaption({
  title,
  codes,
  className,
}: {
  title: string;
  codes: [string, string, string];
  className?: string;
}) {
  return (
    <span
      className={cn(
        "border-divider flex flex-col justify-center gap-[3px] self-stretch border-l px-2 py-1.5",
        className,
      )}
    >
      <span className="text-muted truncate text-center text-[10px] font-semibold">
        {title}
      </span>
      {/* Same tracks and gap as `OddsGroup`, so each code sits over its price. */}
      <span className="text-text grid grid-cols-3 gap-1 text-center">
        {codes.map((code, i) => (
          <span key={`${code}-${i}`}>{code}</span>
        ))}
      </span>
    </span>
  );
}

/**
 * The header of a competition's card: who is playing where, and what each
 * column of prices means.
 */
export function MarketColumnHeaders({
  competition,
  pin,
}: {
  competition: Competition;
  /** The competition's favourite star, where there are favourites. */
  pin?: { pinned: boolean; toggle: () => void };
}) {
  const t = useTranslation();

  return (
    <div
      className={`${BOARD_GRID} bg-raised text-muted min-h-11 items-center text-[11px] font-bold`}
    >
      <span className="flex min-w-0 items-center gap-1.5 py-1.5 pr-2 pl-0.5 text-xs md:py-0">
        {pin && (
          <StarButton
            pinned={pin.pinned}
            label={t.t("sidebar.pinLeague")}
            onClick={pin.toggle}
            size={22}
            iconSize={14}
          />
        )}
        <Flag src={competition.region.flag} width={18} height={12} />
        <span className="text-text truncate">
          {/* A continental cup already says where it is played — the globe
              stands in for the region, as the flag does for a country. */}
          {competition.region.code !== null && (
            <>
              <span className="text-muted font-medium">
                {t.pick(competition.region.name)} ·
              </span>{" "}
            </>
          )}
          {t.pick(competition.name)}
        </span>
      </span>

      <ColumnCaption
        title={t.t("board.markets.matchResult")}
        codes={["1", "X", "2"]}
        className="hidden md:flex"
      />
      <ColumnCaption
        title={t.t("board.markets.doubleChance")}
        codes={["1X", "12", "X2"]}
        className="hidden xl:flex"
      />
      <ColumnCaption
        title={t.t("board.markets.totalGoals")}
        codes={[
          t.t("board.markets.over"),
          t.t("board.markets.line"),
          t.t("board.markets.under"),
        ]}
        className="hidden xl:flex"
      />
      <span className="border-divider hidden place-items-center self-stretch border-l text-[10px] font-semibold md:grid">
        {t.t("board.markets.more")}
      </span>
    </div>
  );
}
