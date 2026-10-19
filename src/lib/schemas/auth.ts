import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
export const passwordSchema = z.string().min(10).max(128);
export const displayNameSchema = z.string().trim().max(40).optional();
// Required whenever Turnstile is configured (Supabase enforces it on its side as well). Unset locally and in CI.
export const captchaTokenSchema = z
  .string()
  .max(2048)
  .optional()
  .refine((v) => Boolean(v) || !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY, "captcha required")
  .transform((v) => v || undefined);
export const mfaCodeSchema = z.string().trim().regex(/^\d{6}$/);

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
  // 16+ and terms accepted (BLUEPRINT §6).
  terms: z.literal("on"),
  captchaToken: captchaTokenSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
  captchaToken: captchaTokenSchema,
});

export const forgotPasswordSchema = z.object({ email: emailSchema, captchaToken: captchaTokenSchema });
export const resetPasswordSchema = z.object({ password: passwordSchema });
export const waitlistSchema = z.object({ email: emailSchema, captchaToken: captchaTokenSchema });
export const feedbackSchema = z.object({ message: z.string().trim().min(1).max(2000) });
