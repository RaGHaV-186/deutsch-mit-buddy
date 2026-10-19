"use server";

import { redirect } from "next/navigation";
import { authErrorKey } from "@/lib/auth/errors";
import { requireSession } from "@/lib/auth/guard";
import { safeNextPath } from "@/lib/auth/next-path";
import { limitError } from "@/lib/rate-limit";
import { mfaCodeSchema } from "@/lib/schemas/auth";
import { createClient } from "@/lib/supabase/server";

export type MfaFormState = { error?: string } | undefined;

export type EnrollResult = { factorId: string; qr: string; secret: string } | { error: string };

/** Starts authenticator setup: returns the QR code (SVG data URI) and the manual-entry key. */
export async function enrollTotpAction(): Promise<EnrollResult> {
  const { userId } = await requireSession();
  const blocked = await limitError(`mfa-enroll:${userId}`, 10, 600);
  if (blocked) return { error: blocked };

  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  if ((factors?.totp?.length ?? 0) > 0) return { error: "generic" };
  // Drop abandoned, never-verified attempts so a retry doesn't pile up factors.
  for (const f of factors?.all ?? []) {
    if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 7)}`,
  });
  if (error || !data) return { error: authErrorKey(error) };
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

export async function verifyEnrollAction(_prev: MfaFormState, formData: FormData): Promise<MfaFormState> {
  const { userId } = await requireSession();
  const code = mfaCodeSchema.safeParse(formData.get("code"));
  const factorId = formData.get("factorId");
  if (!code.success || typeof factorId !== "string" || factorId.length > 64) return { error: "invalid_code" };
  const blocked = await limitError(`mfa-verify:${userId}`, 10, 600);
  if (blocked) return { error: blocked };

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.data });
  if (error) return { error: authErrorKey(error) === "generic" ? "invalid_code" : authErrorKey(error) };
  redirect(safeNextPath(String(formData.get("next") ?? "")));
}

export async function verifyLoginAction(_prev: MfaFormState, formData: FormData): Promise<MfaFormState> {
  const { userId } = await requireSession();
  const code = mfaCodeSchema.safeParse(formData.get("code"));
  if (!code.success) return { error: "invalid_code" };
  const blocked = await limitError(`mfa-verify:${userId}`, 10, 600);
  if (blocked) return { error: blocked };

  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp?.[0];
  if (!factor) redirect("/mfa/setup");
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.data });
  if (error) return { error: authErrorKey(error) === "generic" ? "invalid_code" : authErrorKey(error) };
  redirect(safeNextPath(String(formData.get("next") ?? "")));
}
