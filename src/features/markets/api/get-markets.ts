import { z } from "zod";
import { env } from "@/config/env";
import { apiClient, assertContract } from "@/lib/api/client";
import { mockRepository } from "@/lib/api/mock/repository";
import { marketSchema } from "@/lib/api/schemas";
import type { Market } from "../types";

const responseSchema = z.array(marketSchema);

export async function getMarkets(
  eventId: string,
  signal?: AbortSignal,
): Promise<Market[]> {
  if (env.useMocks) {
    return assertContract(
      `/events/${eventId}/markets`,
      responseSchema,
      await mockRepository.listMarkets(eventId),
    );
  }
  return apiClient.get(`/events/${eventId}/markets`, responseSchema, {
    signal,
  });
}
