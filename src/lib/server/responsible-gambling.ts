import "server-only";
import type {
  Exclusion,
  LimitChange,
  RgLimit,
  SelfExclusionRequest,
} from "@/features/responsible-gaming/types";
import {
  toExclusion,
  toLimit,
  toLimitSet,
  toLimits,
  toSelfExclusionRequest,
} from "@/lib/api/mappers/responsible-gambling";
import { withSession, type Session, type SessionContext } from "./session";
import { upstream } from "./upstream";

/**
 * The player's own protections (C12 §6): their limits, and a break or a
 * self-exclusion. Every call is made for the signed-in player with their
 * session; refusals pass through as `UpstreamError`, Problem intact.
 */

/** The player's limits, current and pending (`GET /v1/me/limits`). */
export async function loadLimits(
  ctx: SessionContext,
  session: Session,
): Promise<RgLimit[]> {
  const { items } = await withSession(ctx, session, (authorization) =>
    upstream("Responsible gambling", { ...ctx, authorization }).GET(
      "/v1/me/limits",
    ),
  );
  return toLimits(items);
}

/**
 * Sets or changes one limit (`PUT /v1/me/limits`). The API decides when it
 * applies — a decrease at once, an increase after its cooling-off — and its
 * answer says which: the limit in force, and any change it holds back.
 */
export async function changeLimit(
  ctx: SessionContext,
  session: Session,
  change: LimitChange,
): Promise<RgLimit> {
  const limit = await withSession(ctx, session, (authorization) =>
    upstream("Responsible gambling", { ...ctx, authorization }).PUT(
      "/v1/me/limits",
      { body: toLimitSet(change) },
    ),
  );
  return toLimit(limit);
}

/**
 * Starts a break or a self-exclusion (`POST /v1/me/self-exclusion`). The API
 * revokes every session of the player as it answers, this one included.
 */
export async function selfExclude(
  ctx: SessionContext,
  session: Session,
  request: SelfExclusionRequest,
): Promise<Exclusion> {
  const exclusion = await withSession(ctx, session, (authorization) =>
    upstream("Responsible gambling", { ...ctx, authorization }).POST(
      "/v1/me/self-exclusion",
      { body: toSelfExclusionRequest(request) },
    ),
  );
  return toExclusion(exclusion);
}
