"use client";

import { memo, useId } from "react";
import { Flag } from "@/components/ui/Flag";
import type { BoardSection } from "@/features/events/types";
import { useBoardFilters } from "@/features/sportsbook/hooks/use-board-filters";
import { sportIdFromSlug } from "@/lib/api/mappers/catalogue";
import { useTodayEat } from "@/lib/i18n/use-today-eat";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useKioskBoard } from "../../hooks/use-kiosk";
import { KioskEventRow } from "./KioskEventRow";

/**
 * The board (F8ca): one sport's competitions on one day, each with its
 * matches and their prices. Loading, nothing on that day (back to today, or —
 * when today is the empty day — to the start), or couldn't load (Try again);
 * once shown, a failed poll changes nothing and the next one tries again.
 */
export function KioskBoard() {
  const t = useTranslation();
  const today = useTodayEat();
  const { filters, set, reset } = useBoardFilters();
  const board = useKioskBoard({
    sportId: sportIdFromSlug(filters.sport),
    date: filters.date,
    filter: filters.filter,
  });

  if (board.data === undefined) {
    if (board.isError) {
      return (
        <BoardNotice
          title={t.t("board.error.title")}
          body={t.t("board.error.body")}
          action={t.t("common.retry")}
          onAction={() => void board.refetch()}
          busy={board.isFetching}
        />
      );
    }
    return <BoardLoading />;
  }

  if (board.data.length === 0) {
    const later = filters.date !== today;
    return (
      <BoardNotice
        title={t.t("board.empty.title")}
        // The kiosk has no filters to change: a sport or a day.
        body={t.t("terminal.kiosk.emptyBody")}
        action={t.t(
          later ? "terminal.kiosk.backToToday" : "board.empty.action",
        )}
        onAction={later ? () => set({ date: today }) : reset}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {board.data.map((section) => (
        <KioskCompetition key={section.competition.id} section={section} />
      ))}
    </div>
  );
}

/**
 * One competition and its matches, headed as on the player's board: its
 * country and flag, then its name — two Premier Leagues are not the same
 * league (review U2). A continental cup has a globe and no country.
 */
const KioskCompetition = memo(function KioskCompetition({
  section,
}: {
  section: BoardSection;
}) {
  const t = useTranslation();
  const heading = useId();
  const { competition } = section;

  return (
    <section
      aria-labelledby={heading}
      className="bg-surface border-border rounded-lg border"
    >
      <h2
        id={heading}
        className="border-divider flex items-center gap-2 border-b px-4 py-3 text-lg font-bold"
      >
        <Flag src={competition.region.flag} width={24} height={16} />
        <span className="min-w-0 truncate">
          {competition.region.code !== null && (
            <>
              <span className="text-muted font-medium">
                {t.pick(competition.region.name)} ·
              </span>{" "}
            </>
          )}
          {t.pick(competition.name)}
        </span>
      </h2>
      <ul>
        {section.events.map((row) => (
          <KioskEventRow key={row.event.id} row={row} />
        ))}
      </ul>
    </section>
  );
});

/** Rows to come, in the board's shape. */
function BoardLoading() {
  return (
    <div aria-busy className="flex flex-col gap-4">
      {Array.from({ length: 2 }, (_, i) => (
        <div
          key={i}
          aria-hidden
          className="bg-surface border-border flex flex-col gap-3 rounded-lg border p-4"
        >
          <span className="bg-raised h-6 w-48 animate-pulse rounded-sm" />
          {Array.from({ length: 3 }, (_, j) => (
            <span
              key={j}
              className="bg-raised h-16 w-full animate-pulse rounded-md"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Nothing to show, why, and what to tap next. */
function BoardNotice({
  title,
  body,
  action,
  onAction,
  busy = false,
}: {
  title: string;
  body: string;
  action: string;
  onAction: () => void;
  busy?: boolean;
}) {
  return (
    <div className="bg-surface border-border flex flex-col items-center gap-2 rounded-lg border px-4 py-12 text-center">
      <p className="text-xl font-bold">{title}</p>
      <p className="text-muted text-base">{body}</p>
      <button
        type="button"
        onClick={onAction}
        disabled={busy}
        className="bg-raised border-divider text-text mt-3 min-h-14 min-w-44 cursor-pointer rounded-md border px-5 text-base font-bold hover:brightness-125 disabled:cursor-wait disabled:opacity-60"
      >
        {action}
      </button>
    </div>
  );
}
