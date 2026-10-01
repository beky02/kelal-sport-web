import { z } from "zod";
import { apiClient } from "@/lib/api/client";
import {
  competitionSummarySchema,
  countryWithLeaguesSchema,
} from "@/lib/api/schemas";
import type { CompetitionSummary, CountryWithLeagues } from "../types";

const topSchema = z.array(competitionSummarySchema);
const countriesSchema = z.array(countryWithLeaguesSchema);

/** Derived from the dictionary and `/v1/sports` counts by the route handler. */
export async function getTopCompetitions(
  signal?: AbortSignal,
): Promise<CompetitionSummary[]> {
  return apiClient.get("/catalogue/competitions/top", topSchema, { signal });
}

export async function getCountries(
  signal?: AbortSignal,
): Promise<CountryWithLeagues[]> {
  return apiClient.get("/catalogue/competitions/countries", countriesSchema, {
    signal,
  });
}
