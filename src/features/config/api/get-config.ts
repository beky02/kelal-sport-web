import { apiClient } from "@/lib/api/client";
import { publicConfigSchema } from "@/lib/api/schemas";
import type { PublicConfigView } from "../types";

export async function getPublicConfig(
  signal?: AbortSignal,
): Promise<PublicConfigView> {
  return apiClient.get("/config", publicConfigSchema, { signal });
}
