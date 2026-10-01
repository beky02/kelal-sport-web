import { env } from "./env";

/**
 * Features built ahead of the release that ships them.
 *
 * Release 1 is pre-match only (D8): no in-play board and no cash out. The code
 * stays, behind these switches, so Release 2 turns them on instead of
 * rebuilding them. Set `NEXT_PUBLIC_FEATURE_*=true` to see them locally.
 */
export const features = env.features;
