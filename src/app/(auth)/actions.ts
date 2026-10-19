"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authErrorKey, isMemberCapError, logAuthError } from "@/lib/auth/errors";
import { requireSession } from "@/lib/auth/guard";
import { safeNextPath } from "@/lib/auth/next-path";
import { isPasswordPwned } from "@/lib/hibp";
import { clientIp, limitError } from "@/lib/rate-limit";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  waitlistSchema,
} from "@/lib/schemas/auth";
import { siteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/turnstile";

export type FormState = { error?: string; done?: boolean } | undefined;

const text = (data: FormData, key: string) => {
  const v = data.get(key);
  return typeof v === "string" ? v : undefined;
};

async function ip() {
  return clientIp(await headers());
}

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse({
    email: text(formData, "email"),
    password: text(formData, "password"),
    displayName: text(formData, "displayName") || undefined,
    terms: text(formData, "terms"),
    captchaToken: text(formData, "cf-turnstile-response"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.some((i) => i.path[0] === "terms") ? "terms_required" : "invalid_input" };
  }
  const { email, password, displayName, captchaToken } = parsed.data;

  const blocked = await limitError(`signup:${await ip()}`, 10, 3600);
  if (blocked) return { error: blocked };
  if (await isPasswordPwned(password)) return { error: "pwned" };

  const supabase = await createClient();
  const open = await supabase.rpc("signup_open");
  if (open.data === false) redirect("/waitlist?full=1");

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      captchaToken,
      emailRedirectTo: `${siteUrl()}/auth/confirm`,
      data: { display_name: displayName ?? "", terms_accepted: "true" },
    },
  });
  if (error) {
    // The cap trigger and other database failures look alike to GoTrue; only a full house means "waitlist".
    if (isMemberCapError(error) && (await supabase.rpc("signup_open")).data === false) redirect("/waitlist?full=1");
    logAuthError("signUp", error);
    return { error: authErrorKey(error) };
  }
  // Same answer whether or not the email already had an account.
  redirect("/check-email?type=confirm");
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse({
    email: text(formData, "email"),
    password: text(formData, "password"),
    captchaToken: text(formData, "cf-turnstile-response"),
  });
  if (!parsed.success) return { error: "invalid_input" };
  const blocked = await limitError(`login:${await ip()}`, 20, 600);
  if (blocked) return { error: blocked };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { captchaToken: parsed.data.captchaToken },
  });
  if (error) {
    if (error.code !== "invalid_credentials") logAuthError("signInWithPassword", error);
    return { error: authErrorKey(error) };
  }

  const next = text(formData, "next");
  // The proxy and /mfa take it from here (set up or verify two-factor).
  redirect(next ? `/mfa?next=${encodeURIComponent(safeNextPath(next))}` : "/mfa");
}

export async function googleSignInAction(): Promise<{ url?: string; error?: string }> {
  const blocked = await limitError(`oauth:${await ip()}`, 20, 600);
  if (blocked) return { error: blocked };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${siteUrl()}/auth/callback`, skipBrowserRedirect: true },
  });
  if (error || !data.url) {
    logAuthError("signInWithOAuth", error);
    return { error: "oauth" };
  }
  return { url: data.url };
}

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: text(formData, "email"),
    captchaToken: text(formData, "cf-turnstile-response"),
  });
  if (!parsed.success) return { error: "invalid_input" };
  const blocked = await limitError(`reset:${await ip()}`, 5, 3600);
  if (blocked) return { error: blocked };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    captchaToken: parsed.data.captchaToken,
    redirectTo: `${siteUrl()}/auth/confirm/recovery`,
  });
  if (error) {
    logAuthError("resetPasswordForEmail", error);
    // Only errors that don't reveal whether the email has an account are shown; the rest looks like success.
    const key = authErrorKey(error);
    if (["captcha", "rate_limited", "email_rate_limit", "email_not_authorized", "unavailable"].includes(key)) {
      return { error: key };
    }
  }
  // Never reveal whether the email has an account.
  redirect("/check-email?type=reset");
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const parsed = resetPasswordSchema.safeParse({ password: text(formData, "password") });
  if (!parsed.success) return { error: "weak_password" };
  if (await isPasswordPwned(parsed.data.password)) return { error: "pwned" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    // Members with two-factor must prove it before changing the password.
    if (error.code === "insufficient_aal") redirect("/mfa?next=%2Freset-password");
    logAuthError("updateUser", error);
    return { error: authErrorKey(error) };
  }
  await supabase.auth.signOut({ scope: "others" });
  redirect("/home");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function joinWaitlistAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = waitlistSchema.safeParse({
    email: text(formData, "email"),
    captchaToken: text(formData, "cf-turnstile-response"),
  });
  if (!parsed.success) return { error: "invalid_input" };
  const address = await ip();
  const blocked = await limitError(`waitlist:${address}`, 5, 3600);
  if (blocked) return { error: blocked };
  if (!(await verifyTurnstile(parsed.data.captchaToken, address))) return { error: "captcha" };

  const { error } = await createAdminClient().from("waitlist").insert({ email: parsed.data.email });
  // 23505 = already on the list; treat as success so the form can't be used to probe emails.
  if (error && error.code !== "23505") {
    console.error("waitlist insert failed", { code: error.code });
    return { error: "unavailable" };
  }
  return { done: true };
}
