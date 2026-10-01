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

export const passwordRules = {
  length: (value: string) => value.length >= 8,
  letterAndNumber: (value: string) =>
    /[A-Za-z]/.test(value) && /\d/.test(value),
  match: (value: string, confirm: string) =>
    value.length > 0 && value === confirm,
};

export const passwordSchema = z
  .object({ password: z.string(), confirm: z.string() })
  .refine((v) => passwordRules.length(v.password))
  .refine((v) => passwordRules.letterAndNumber(v.password))
  .refine((v) => passwordRules.match(v.password, v.confirm));

export type PasswordForm = z.infer<typeof passwordSchema>;

/** Fayda's FIN is twelve digits; grouping while typing is allowed. */
export const kycSchema = z.object({
  fin: z
    .string()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((digits) => digits.length === 12),
  fullName: z.string().trim().min(2),
  dateOfBirth: z.string().trim().min(1),
});

export type KycForm = z.input<typeof kycSchema>;
