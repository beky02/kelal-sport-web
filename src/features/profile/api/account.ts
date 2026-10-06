import { z } from "zod";
import { apiClient } from "@/lib/api/client";
import { deviceSessionsSchema, sessionViewSchema } from "@/lib/api/schemas";
import type { SessionView } from "@/features/auth/types";
import type { AccountChange, DeviceSession } from "../types";

/**
 * Saves the language or the marketing consent on the account. The answer is
 * `/api/me`'s own shape: the account as the API now has it.
 */
export const updateAccount = (change: AccountChange): Promise<SessionView> =>
  apiClient.patch("/me", sessionViewSchema, change);

/** The devices signed in to the account, this one marked (`/api/me/sessions`). */
export const getDeviceSessions = (
  signal?: AbortSignal,
): Promise<DeviceSession[]> =>
  apiClient.get("/me/sessions", deviceSessionsSchema, { signal });

/** Signs one device out; the API answers 204. */
export const revokeDeviceSession = (id: string): Promise<undefined> =>
  apiClient.delete(`/me/sessions/${encodeURIComponent(id)}`, z.undefined());
