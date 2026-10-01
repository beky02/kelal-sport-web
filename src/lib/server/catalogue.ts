import "server-only";
import type { Lang } from "@/types/common";
import type {
  BoardSection,
  EventDetail,
  EventFilters,
} from "@/features/events/types";
import type {
  CompetitionSummary,
  CountryWithLeagues,
} from "@/features/competitions/types";
import type { Sport } from "@/features/sports/types";
import type { SearchResults } from "@/features/search/types";
import {
  lookup,
  toBoard,
  toCountries,
  toEventDetail,
  toSearchResults,
  toSports,
  toTopCompetitions,
  type Dictionary,
  type Lookup,
} from "@/lib/api/mappers/catalogue";
import { todayEat } from "@/lib/i18n/dates";
import { both, UpstreamError, unwrap, upstream } from "./upstream";

/**
 * The catalogue, as the screens want it.
 *
 * Names come back in one language per request, but the UI switches language
 * without refetching, so each read is made in both and merged by the mappers.
 * The dictionary is versioned and changes rarely; it is held per tenant.
 */

const DICTIONARY_TTL_MS = 5 * 60 * 1000;
const dictionaries = new Map<string, { value: Dictionary; expires: number }>();

async function dictionary(tenant: string, lang: Lang): Promise<Dictionary> {
  const key = `${tenant}:${lang}`;
  const cached = dictionaries.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;

  const value = unwrap(
    await upstream("Catalogue", { tenant, lang }).GET("/v1/dictionary"),
  );
  dictionaries.set(key, { value, expires: Date.now() + DICTIONARY_TTL_MS });
  return value;
}

const dict = async (tenant: string): Promise<Lookup> =>
  lookup(await both((lang) => dictionary(tenant, lang)));

async function sportCounts(tenant: string) {
  const { items } = unwrap(
    await upstream("Catalogue", { tenant, lang: "en" }).GET("/v1/sports"),
  );
  return items;
}

export async function loadSports(tenant: string): Promise<Sport[]> {
  const [d, counts] = await Promise.all([dict(tenant), sportCounts(tenant)]);
  return toSports(d, counts);
}

export async function loadTopCompetitions(
  tenant: string,
): Promise<CompetitionSummary[]> {
  const [d, counts] = await Promise.all([dict(tenant), sportCounts(tenant)]);
  return toTopCompetitions(d, counts);
}

export async function loadCountries(
  tenant: string,
): Promise<CountryWithLeagues[]> {
  const [d, counts] = await Promise.all([dict(tenant), sportCounts(tenant)]);
  return toCountries(d, counts);
}

export async function loadBoard(
  tenant: string,
  filters: EventFilters,
  dataSaver: boolean,
): Promise<BoardSection[]> {
  // Release 1 is pre-match only (D8): there is nothing in play to list.
  if (filters.live) return [];

  const query = {
    sport: filters.sportId,
    tournament: filters.competitionId,
    date: filters.filter === "today" ? todayEat() : filters.date,
    sort:
      filters.filter === "top"
        ? ("popularity" as const)
        : ("start_time" as const),
  };
  const [d, pages] = await Promise.all([
    dict(tenant),
    both(
      async (lang) =>
        unwrap(
          await upstream("Catalogue", { tenant, lang }).GET("/v1/events", {
            params: { query },
          }),
        ).items,
    ),
  ]);
  return toBoard(pages, d, new Date(), dataSaver);
}

export async function loadEvent(
  tenant: string,
  id: string,
  dataSaver: boolean,
): Promise<EventDetail | null> {
  try {
    const [d, pair] = await Promise.all([
      dict(tenant),
      both(async (lang) =>
        unwrap(
          await upstream("Catalogue", { tenant, lang }).GET("/v1/events/{id}", {
            params: {
              path: { id },
              // Every group, so the page can filter without another round trip.
              query: { groups: "main,goals,halves,handicap,corners,player" },
            },
          }),
        ),
      ),
    ]);
    return toEventDetail(pair, d, new Date(), dataSaver);
  } catch (error) {
    if (error instanceof UpstreamError && error.status === 404) return null;
    throw error;
  }
}

export async function loadSearch(
  tenant: string,
  q: string,
  dataSaver: boolean,
): Promise<SearchResults> {
  const [d, counts, pair] = await Promise.all([
    dict(tenant),
    sportCounts(tenant),
    both(async (lang) =>
      unwrap(
        await upstream("Catalogue", { tenant, lang }).GET("/v1/search", {
          params: { query: { q } },
        }),
      ),
    ),
  ]);
  return toSearchResults(pair, d, counts, new Date(), dataSaver);
}
