import { z } from "zod";
import { apiClient } from "@/lib/api/client";
import { sportSchema } from "@/lib/api/catalogue-schemas";
import type { Sport } from "../types";

const responseSchema = z.array(sportSchema);

export async function getSports(signal?: AbortSignal): Promise<Sport[]> {
  return apiClient.get("/catalogue/sports", responseSchema, { signal });
}
