"use client";

import { ListFilter } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { LiveDot } from "@/components/ui/LiveTag";
import { Segmented } from "@/components/ui/Segmented";
import { useLocale } from "@/lib/i18n/locale";
import { useSportsbookChrome } from "../chrome";
import type { BoardFilter } from "../hooks/use-board-filters";

/**
 * What you are looking at, and how it is filtered.
 *
 * The clock note is not decoration: kickoff times read differently on the
 * Ethiopian clock, so the header states which one is in use.
 */
export function BoardHeader({
  title,
  live,
  filter,
  onFilterChange,
}: {
  title: string;
  live: boolean;
  filter: BoardFilter;
  onFilterChange: (filter: BoardFilter) => void;
}) {
  const t = useTranslation();
  const { clock } = useLocale();
  const openLeagues = useSportsbookChrome().useOpenLeagues();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-0.5 pt-0.5">
      <h2 className="flex items-center gap-2 text-[22px]">
        {live && <LiveDot className="size-2" />}
        {title}
        <span className="font-body text-muted text-[11px] font-medium">
          {t.t(clock === "eth" ? "clock.ethiopian" : "clock.eat")}
        </span>
      </h2>

      <Segmented
        value={filter}
        onChange={onFilterChange}
        size="sm"
        fill="raised"
        className="bg-surface"
        options={[
          { value: "top", label: t.t("board.filters.top") },
          { value: "upcoming", label: t.t("board.filters.upcoming") },
          { value: "today", label: t.t("board.filters.today") },
        ]}
      />

      {/* A phone has no sidebar and no menu button, so the league list is
          offered here, beside the filters it refines — where the site has a
          drawer for it. */}
      {openLeagues && (
        <button
          type="button"
          onClick={openLeagues}
          className="text-text font-body ms-auto flex h-10 cursor-pointer items-center gap-1.5 bg-transparent px-1 text-[13px] font-bold md:hidden"
        >
          <ListFilter size={15} strokeWidth={1.5} aria-hidden />
          {t.t("board.leagues")}
        </button>
      )}
    </div>
  );
}
