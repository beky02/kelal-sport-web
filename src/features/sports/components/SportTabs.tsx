"use client";

import { useTranslation } from "@/lib/i18n/use-translation";
import { Skeleton } from "@/components/ui/Skeleton";
import { SportIcon } from "@/components/ui/SportIcon";
import { cn } from "@/lib/utils/cn";
import { useSports } from "../hooks/use-sports";

/**
 * The sport switcher on a phone: one scrolling row under the app bar.
 *
 * The phone's equivalent of the sidebar's Sports card, with the same counts —
 * in-play numbers on the live board, in the live colour, so "how many can I bet
 * on right now?" has the same answer on either screen.
 */
export function SportTabs({
  activeSlug,
  live,
  onSelect,
  className,
}: {
  activeSlug: string;
  live: boolean;
  onSelect: (slug: string) => void;
  className?: string;
}) {
  const t = useTranslation();
  const { data: sports, isPending } = useSports();

  return (
    <div
      role="group"
      aria-label={t.t("sidebar.sports")}
      className={cn(
        "no-scrollbar border-divider flex overflow-x-auto border-b",
        className,
      )}
    >
      {isPending
        ? Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="flex h-12 shrink-0 items-center gap-1.5 px-3"
            >
              <Skeleton className="size-[18px]" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))
        : sports?.map((sport) => {
            const active = sport.slug === activeSlug;
            const count = live ? sport.liveCount : sport.eventCount;

            return (
              <button
                key={sport.id}
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(sport.slug)}
                className={cn(
                  "font-body flex h-12 shrink-0 cursor-pointer items-center gap-1.5 border-b-2 bg-transparent px-3 text-[13px] font-bold whitespace-nowrap",
                  active
                    ? "border-accent text-text"
                    : "text-muted border-transparent",
                )}
              >
                <SportIcon paths={sport.iconPaths} size={18} />
                {t.pick(sport.name)}
                <span
                  className={cn(
                    "text-[10px] font-bold",
                    live && count > 0 ? "text-live" : "text-muted",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
    </div>
  );
}
