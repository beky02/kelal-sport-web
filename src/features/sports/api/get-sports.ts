import { z } from "zod";
import { env } from "@/config/env";
import { apiClient, assertContract } from "@/lib/api/client";
import { mockRepository } from "@/lib/api/mock/repository";
import { sportSchema } from "@/lib/api/schemas";
import type { Sport } from "../types";

const responseSchema = z.array(sportSchema);

export async function getSports(signal?: AbortSignal): Promise<Sport[]> {
  if (env.useMocks) {
    return assertContract(
      "/sports",
      responseSchema,
      await mockRepository.listSports(),
    );
  }
  return apiClient.get("/sports", responseSchema, { signal });
}
