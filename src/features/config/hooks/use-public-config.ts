"use client";

import { useQuery } from "@tanstack/react-query";
import { STALE_TIME } from "@/config/constants";
import { configKeys } from "@/lib/query/keys";
import { getPublicConfig } from "../api/get-config";

/** The tenant's public configuration, including the slip's rule set. */
export function usePublicConfig() {
  return useQuery({
    queryKey: configKeys.public(),
    queryFn: ({ signal }) => getPublicConfig(signal),
    staleTime: STALE_TIME.config,
  });
}
