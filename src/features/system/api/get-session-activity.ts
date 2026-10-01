import { env } from "@/config/env";
import { apiClient, assertContract } from "@/lib/api/client";
import {
  mockRepository,
  type SessionActivity,
} from "@/lib/api/mock/repository";
import { sessionActivitySchema } from "@/lib/api/schemas";

export async function getSessionActivity(
  signal?: AbortSignal,
): Promise<SessionActivity> {
  if (env.useMocks) {
    return assertContract(
      "/me/session-activity",
      sessionActivitySchema,
      await mockRepository.getSessionActivity(),
    );
  }
  return apiClient.get("/me/session-activity", sessionActivitySchema, {
    signal,
  });
}

export type { SessionActivity };
