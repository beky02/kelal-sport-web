/**
 * The reality check's clock (RG-04, F7b). Time only: what the player staked
 * and won is the API's to say (contract request 012), never added up here.
 *
 * A visit starts when this tab first shows the signed-in player (plan
 * decision 2, until the API owns the play session). Checks come due at whole
 * intervals of it: one interval in, two, three…
 */

const MINUTE = 60_000;

/**
 * When the next check comes due: the first whole interval of the visit after
 * the last one answered, or after the start when none has been.
 */
export function nextCheckAt(
  startedAt: number,
  intervalMinutes: number,
  answeredAt: number | null,
): number {
  const step = intervalMinutes * MINUTE;
  const from = Math.max(answeredAt ?? startedAt, startedAt);
  return startedAt + (Math.floor((from - startedAt) / step) + 1) * step;
}

/** Whole minutes since the visit started. */
export const playedMinutes = (startedAt: number, now: number): number =>
  Math.max(0, Math.floor((now - startedAt) / MINUTE));
