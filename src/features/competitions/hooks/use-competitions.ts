"use client";

import { useQuery } from "@tanstack/react-query";
import { STALE_TIME } from "@/config/constants";
import { competitionKeys } from "@/lib/query/keys";
import { getCountries, getTopCompetitions } from "../api/get-competitions";

export function useTopCompetitions() {
  return useQuery({
    queryKey: competitionKeys.top(),
    queryFn: ({ signal }) => getTopCompetitions(signal),
    staleTime: STALE_TIME.competitions,
  });
}

export function useCountries() {
  return useQuery({
    queryKey: competitionKeys.countries(),
    queryFn: ({ signal }) => getCountries(signal),
    staleTime: STALE_TIME.competitions,
  });
}
