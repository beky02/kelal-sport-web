"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { LiveDot } from "@/components/ui/LiveTag";
import { useSportsbookChrome } from "@/features/sportsbook/chrome";
import { formatKickoff } from "@/lib/i18n/format";
import { useLocale } from "@/lib/i18n/locale";
import { useSearch } from "../hooks/use-search";

/**
 * Search, with results under the field.
 *
 * Leagues first and capped at three, then up to six fixtures: the job is to get
 * someone to a match in one keystroke-and-click, not to page through a result
 * set. Escape and the clear button both close it, as does clicking away.
 */
export function HeaderSearch() {
  const t = useTranslation();
  const router = useRouter();
  const { clock } = useLocale();
  const { links } = useSportsbookChrome();

  const [query, setQuery] = useState("");
  const { data } = useSearch(query);
  const listId = useId();
  const container = useRef<HTMLDivElement>(null);

  const open = query.trim().length > 0;
  const leagues = data?.leagues ?? [];
  const events = data?.events ?? [];
  // Only claim "no results" once the answer is in, never mid-request.
  const noResults =
    open && data !== undefined && leagues.length === 0 && events.length === 0;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setQuery("");
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const go = (href: string) => {
    setQuery("");
    router.push(href);
  };

  return (
    <div ref={container} className="relative hidden xl:block">
      <label className="bg-raised text-muted flex h-9 w-[260px] items-center gap-2 rounded-md pr-1.5 pl-3">
        <Search size={15} strokeWidth={1.5} aria-hidden />
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={t.t("header.search")}
          placeholder={t.t("header.search")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setQuery("");
          }}
          className="font-body text-text min-w-0 flex-1 border-0 bg-transparent text-[13px] outline-none"
        />
        {open && (
          <button
            type="button"
            aria-label={t.t("search.clear")}
            onClick={() => setQuery("")}
            className="text-muted hover:text-text grid size-[26px] shrink-0 cursor-pointer place-items-center rounded-sm bg-transparent p-0"
          >
            <X size={14} strokeWidth={1.8} aria-hidden />
          </button>
        )}
      </label>

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label={t.t("header.search")}
          className="bg-surface border-divider absolute top-[42px] right-0 z-30 flex w-[380px] flex-col rounded-lg border p-1.5"
        >
          {leagues.length > 0 && (
            <>
              <div className="label-caps text-muted px-2.5 pt-2 pb-1">
                {t.t("search.leagues")}
              </div>
              {leagues.map(({ competition, eventCount }) => (
                <button
                  key={competition.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => go(links.competition(competition.id))}
                  className="font-body text-text hover:bg-raised flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-sm bg-transparent px-2.5 text-left text-[13px] font-semibold"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {t.pick(competition.name)}
                  </span>
                  <span className="text-muted text-[11px] font-medium">
                    {t.pick(competition.region.name)} · {eventCount}
                  </span>
                </button>
              ))}
            </>
          )}

          {events.length > 0 && (
            <>
              <div className="label-caps text-muted px-2.5 pt-2 pb-1">
                {t.t("search.matches")}
              </div>
              {events.map(({ event, competition }) => (
                <button
                  key={event.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => go(links.event(event.id))}
                  className="font-body text-text hover:bg-raised flex min-h-12 w-full cursor-pointer flex-col items-start justify-center gap-0.5 rounded-sm bg-transparent px-2.5 py-1 text-left"
                >
                  <span className="max-w-full truncate text-[13px] font-semibold">
                    {t.pick(event.home.name)} – {t.pick(event.away.name)}
                  </span>
                  <span className="text-muted flex items-center gap-1.5 text-[11px]">
                    {event.status === "live" && event.score ? (
                      <>
                        <LiveDot />
                        {event.minute} · {event.score.home}–{event.score.away} ·{" "}
                        {t.pick(competition.name)}
                      </>
                    ) : (
                      <>
                        {formatKickoff(event.kickoff, t.lang, clock)} ·{" "}
                        {t.pick(competition.name)}
                      </>
                    )}
                  </span>
                </button>
              ))}
            </>
          )}

          {noResults && (
            <div role="status" className="flex flex-col gap-1 px-2.5 py-3.5">
              <span className="font-semibold">
                {t.t("search.noResultsTitle", { query: query.trim() })}
              </span>
              <span className="text-muted text-xs">
                {t.t("search.noResultsBody")}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
