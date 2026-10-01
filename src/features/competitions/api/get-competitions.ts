import { z } from "zod";
import { env } from "@/config/env";
import { apiClient, assertContract } from "@/lib/api/client";
import { mockRepository } from "@/lib/api/mock/repository";
import {
  competitionSummarySchema,
  countryWithLeaguesSchema,
} from "@/lib/api/schemas";
import type { CompetitionSummary, CountryWithLeagues } from "../types";

const topSchema = z.array(competitionSummarySchema);
const countriesSchema = z.array(countryWithLeaguesSchema);

export async function getTopCompetitions(
  signal?: AbortSignal,
): Promise<CompetitionSummary[]> {
  if (env.useMocks) {
    return assertContract(
      "/competitions/top",
      topSchema,
      await mockRepository.listTopCompetitions(),
    );
  }
  return apiClient.get("/competitions/top", topSchema, { signal });
}

export async function getCountries(
  signal?: AbortSignal,
): Promise<CountryWithLeagues[]> {
  if (env.useMocks) {
    return assertContract(
      "/countries",
      countriesSchema,
      await mockRepository.listCountries(),
    );
  }
  return apiClient.get("/countries", countriesSchema, { signal });
}
