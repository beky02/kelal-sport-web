import { compactCrockford } from "@/features/tickets/lib/number";
import { ACTIVATION_CODE } from "@/lib/api/terminal-schemas";

/**
 * An activation code as the technician typed it → the contract's 8 Crockford
 * characters, or null. Forgives what the alphabet was designed to forgive
 * (case, spaces, hyphens, O for 0, I or L for 1), so a typo of that kind
 * never spends one of the five attempts an hour.
 */
export function normaliseActivationCode(raw: string): string | null {
  const compact = compactCrockford(raw);
  return ACTIVATION_CODE.test(compact) ? compact : null;
}
