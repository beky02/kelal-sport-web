"use client";

import { Calendar, WifiOff } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { StateMessage } from "@/components/feedback/StateMessage";
import { Card } from "@/components/ui/Card";
import { useBoardFilters } from "../hooks/use-board-filters";
import { useSportsbookBoard } from "../hooks/use-sportsbook-board";
import { BoardSkeleton } from "./BoardSkeleton";
import { CompetitionSection } from "./CompetitionSection";

/**
 * The list of competitions and their fixtures.
 *
 * Owns the four states this data can be in — loading, empty, failed, loaded — so
 * no caller has to reimplement them.
 */
export function Board({
  live,
  competitionId,
}: {
  live: boolean;
  competitionId?: string;
}) {
  const t = useTranslation();
  const { reset } = useBoardFilters();
  const query = useSportsbookBoard(live, competitionId);

  if (query.isPending) return <BoardSkeleton />;

  if (query.isError) {
    return (
      <Card>
        <StateMessage
          icon={<WifiOff size={24} strokeWidth={1.5} />}
          title={t.t("board.error.title")}
          body={t.t("board.error.body")}
          action={{
            label: t.t("common.retry"),
            onClick: () => query.refetch(),
          }}
        />
      </Card>
    );
  }

  if (query.data.length === 0) {
    return (
      <Card>
        <StateMessage
          icon={<Calendar size={24} strokeWidth={1.5} />}
          title={t.t("board.empty.title")}
          body={t.t("board.empty.body")}
          // A dead end is worse than a wrong filter: offer the way back.
          action={{ label: t.t("board.empty.action"), onClick: reset }}
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {query.data.map((section) => (
        <CompetitionSection key={section.competition.id} section={section} />
      ))}
    </div>
  );
}
