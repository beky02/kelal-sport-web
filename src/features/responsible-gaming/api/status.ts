import { env } from "@/config/env";
import { apiClient, assertContract } from "@/lib/api/client";
import {
  mockRepository,
  type ResponsibleGamingStatus,
} from "@/lib/api/mock/repository";
import { responsibleGamingStatusSchema } from "@/lib/api/schemas";

export async function getResponsibleGamingStatus(
  signal?: AbortSignal,
): Promise<ResponsibleGamingStatus> {
  if (env.useMocks) {
    return assertContract(
      "/me/responsible-gaming",
      responsibleGamingStatusSchema,
      await mockRepository.getResponsibleGamingStatus(),
    );
  }
  return apiClient.get(
    "/me/responsible-gaming",
    responsibleGamingStatusSchema,
    {
      signal,
    },
  );
}

export async function startBreak(
  kind: "cool-off" | "self-exclusion",
  until: string,
): Promise<ResponsibleGamingStatus> {
  if (env.useMocks) {
    return assertContract(
      "/me/responsible-gaming",
      responsibleGamingStatusSchema,
      await mockRepository.startResponsibleGamingBreak(kind, until),
    );
  }
  return apiClient.post(
    "/me/responsible-gaming/break",
    responsibleGamingStatusSchema,
    { kind, until },
  );
}

export type { ResponsibleGamingStatus };
