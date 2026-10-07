import { z } from "zod";

/**
 * A decimal-string amount of money, `"1250.00"`, shared by `schemas.ts` and the
 * booking schemas the kiosk loads (`booking-schemas.ts`).
 */
// `abort`: a later check (an amount above zero) never sees what isn't one —
// it would throw, and a malformed body must be a 422, never a 500.
export const moneySchema = z.string().regex(/^-?\d+\.\d{2}$/, { abort: true });
