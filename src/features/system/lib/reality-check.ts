/**
 * The reality check's clock (RG-04, F7b). Time only: what the player staked
 * and won is the API's to say (contract request 012), never added up here.
 *
 * A visit starts when this tab first shows the signed-in player (plan
 * decision 2, until the API owns the play session). The first check comes one
 * interval in, each next one an interval after the player answered the last.
 */

const MINUTE = 60_000;

/**
 * When the next check comes due: one interval after the visit started, then
 * one interval after the last answer — so a check that opened late (it waited
 * behind another dialog) is never followed by another moments later.
 */
export function nextCheckAt(
  startedAt: number,
  intervalMinutes: number,
  answeredAt: number | null,
): number {
  return (
    Math.max(answeredAt ?? startedAt, startedAt) + intervalMinutes * MINUTE
  );
}

/** Whole minutes since the visit started. */
export const playedMinutes = (startedAt: number, now: number): number =>
  Math.max(0, Math.floor((now - startedAt) / MINUTE));
