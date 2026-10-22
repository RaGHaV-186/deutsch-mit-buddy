"use server";

import { redirect } from "next/navigation";
import { requireAal2 } from "@/lib/auth/guard";
import { ensureLessonCards } from "@/lib/cards/ensure-unlocked";
import { findStartingPoint } from "@/lib/curriculum/starting-points";
import { getProfile } from "@/lib/profile";
import { limitError } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export type OnboardingState = { error?: string } | undefined;

export async function saveStartingPointAction(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const { userId } = await requireAal2();
  const blocked = await limitError(`onboard:${userId}`, 10, 600);
  if (blocked) return { error: blocked };

  const seq = Number(formData.get("seq"));
  const point = Number.isInteger(seq) ? findStartingPoint(seq) : undefined;
  if (!point) return { error: "invalid_input" };

  const profile = await getProfile(userId);
  if (!profile) return { error: "generic" };
  if (profile.onboarded_at) redirect("/home");

  const needsTerms = !profile.terms_accepted_at;
  if (needsTerms && formData.get("terms") !== "on") return { error: "terms_required" };

  const now = new Date().toISOString();
  // Written with the service role: members have no UPDATE right on these columns. Scoped to the verified user.
  const { error } = await createAdminClient()
    .from("profiles")
    .update({
      start_code: point.code,
      session_seq: point.seq,
      onboarded_at: now,
      ...(needsTerms ? { terms_accepted_at: now } : {}),
    })
    .eq("user_id", userId)
    .is("onboarded_at", null);
  if (error) return { error: "generic" };
  // The cards of the published lessons up to the chosen one (earlier ones as already seen). A failure here never blocks sign-up.
  await ensureLessonCards(userId);
  redirect("/home");
}
