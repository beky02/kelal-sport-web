import "server-only";
import type { Player } from "@/features/auth/types";
import type { AccountChange, DeviceSession } from "@/features/profile/types";
import { toDeviceSessions, toMePatch } from "@/lib/api/mappers/account";
import { toPlayer } from "@/lib/api/mappers/auth";
import { withSession, type Session, type SessionContext } from "./session";
import { upstream } from "./upstream";

/**
 * The player's account (C01 §6): the preferences they keep on it and the
 * devices signed in to it (REG-10). Every call is made for the signed-in
 * player with their session; refusals pass through as `UpstreamError`,
 * Problem intact.
 */

/**
 * Changes the language or the marketing consent (`PATCH /v1/me`) and answers
 * with the account as the API now has it — the value every screen shows,
 * never the one the browser asked for.
 */
export async function updateAccount(
  ctx: SessionContext,
  session: Session,
  change: AccountChange,
): Promise<Player> {
  const me = await withSession(ctx, session, (authorization) =>
    upstream("Me", { ...ctx, authorization }).PATCH("/v1/me", {
      body: toMePatch(change),
    }),
  );
  return toPlayer(me);
}

/** The devices signed in to the account, this one marked (`GET /v1/me/sessions`). */
export async function loadDeviceSessions(
  ctx: SessionContext,
  session: Session,
): Promise<DeviceSession[]> {
  const { items } = await withSession(ctx, session, (authorization) =>
    upstream("Me", { ...ctx, authorization }).GET("/v1/me/sessions"),
  );
  return toDeviceSessions(items);
}

/** Signs one device out (`DELETE /v1/me/sessions/{id}`); another player's is the API's 404. */
export async function revokeDeviceSession(
  ctx: SessionContext,
  session: Session,
  id: string,
): Promise<void> {
  await withSession(ctx, session, (authorization) =>
    upstream("Me", { ...ctx, authorization }).DELETE("/v1/me/sessions/{id}", {
      params: { path: { id } },
    }),
  );
}
