import { z } from "zod";

/**
 * Ethiopian mobile numbers are nine digits after +251 and start 9 or 7.
 * Spaces are allowed while typing and stripped before validating.
 */
export const phoneSchema = z.object({
  phone: z
    .string()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((digits) => /^[97]\d{8}$/.test(digits)),
});

export type PhoneForm = z.input<typeof phoneSchema>;

/**
 * C01 §2 and REG-06: at least 8 characters, no composition rules — length is
 * what makes a password strong, and the API blocks breached ones (its
 * `VALIDATION_FAILED` on the field). 128 is the contract's limit.
 */
export const PASSWORD_MAX = 128;

export const passwordRules = {
  length: (value: string) => value.length >= 8,
  match: (value: string, confirm: string) =>
    value.length > 0 && value === confirm,
};

/**
 * Fayda's FIN is twelve digits (inside the contract's 12–16); grouping while
 * typing is allowed and stripped before sending.
 */
export const finSchema = z.object({
  fin: z
    .string()
    .refine((value) => /^[\d\s-]*$/.test(value))
    .transform((value) => value.replace(/\D/g, ""))
    .refine((digits) => digits.length === 12),
});

export type FinForm = z.input<typeof finSchema>;
