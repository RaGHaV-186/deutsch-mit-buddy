import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
export const passwordSchema = z.string().min(10).max(128);
export const displayNameSchema = z.string().trim().max(40).optional();
export const captchaTokenSchema = z.string().min(1).max(2048);
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
