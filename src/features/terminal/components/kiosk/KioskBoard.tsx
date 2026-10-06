"use client";

import { useBoardFilters } from "@/features/sportsbook/hooks/use-board-filters";
import { sportIdFromSlug } from "@/lib/api/mappers/catalogue";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useKioskBoard } from "../../hooks/use-kiosk";
import { KioskEventRow } from "./KioskEventRow";

/**
 * The board (F8ca): one sport's competitions on one day, each with its
 * matches and their prices. Loading, nothing on that day (with the way back
 * to the start), or couldn't load (Try again); once shown, a failed poll
 * changes nothing and the next one tries again.
 */
export function KioskBoard() {
  const t = useTranslation();
  const { filters, reset } = useBoardFilters();
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
    return (
      <BoardNotice
        title={t.t("board.empty.title")}
        // The kiosk has no filters to change: a sport or a day.
        body={t.t("terminal.kiosk.emptyBody")}
        action={t.t("board.empty.action")}
        onAction={reset}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {board.data.map((section) => (
        <section
          key={section.competition.id}
          className="bg-surface border-border rounded-lg border"
        >
          <h2 className="border-divider border-b px-4 py-3 text-lg font-bold">
            {t.pick(section.competition.name)}
          </h2>
          <ul>
            {section.events.map((row) => (
              <KioskEventRow key={row.event.id} row={row} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

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
