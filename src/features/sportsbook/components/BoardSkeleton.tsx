import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { BOARD_GRID, HIDE_BELOW_XL } from "../lib/grid";

/**
 * Holds the board's shape while it loads.
 *
 * Same grid and row height as the real thing, so prices land where the skeleton
 * was instead of shoving the page down.
 */
export function BoardSkeleton({ sections = 2, rows = 3 }) {
  return (
    <div data-testid="board-skeleton" className="flex flex-col gap-2.5">
      {Array.from({ length: sections }, (_, s) => (
        <Card key={s} className="overflow-hidden">
          <div className="bg-raised flex min-h-11 items-center gap-2 px-3">
            <Skeleton className="size-3.5 rounded-full" />
            <Skeleton className="h-3 w-40" />
          </div>
          {Array.from({ length: rows }, (_, r) => (
            <div
              key={r}
              className={`${BOARD_GRID} border-divider min-h-[68px] items-center border-t`}
            >
              <div className="flex flex-col gap-2 py-2.5 pr-2 pl-2.5">
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-3.5 w-2/5" />
                <Skeleton className="h-2.5 w-28" />
              </div>
              <div className="grid grid-cols-3 gap-1 px-2 pb-2 md:pb-0">
                <Skeleton className="h-9" />
                <Skeleton className="h-9" />
                <Skeleton className="h-9" />
              </div>
              <div className={`${HIDE_BELOW_XL} grid-cols-3 gap-1 px-2`}>
                <Skeleton className="h-9" />
                <Skeleton className="h-9" />
                <Skeleton className="h-9" />
              </div>
              <div className={`${HIDE_BELOW_XL} grid-cols-3 gap-1 px-2`}>
                <Skeleton className="h-9" />
                <Skeleton className="h-9" />
                <Skeleton className="h-9" />
              </div>
              <div className="hidden md:block" />
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}
