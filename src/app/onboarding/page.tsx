import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { OnboardingForm } from "@/components/OnboardingForm";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { requireAal2 } from "@/lib/auth/guard";
import { groupByPhase, STARTING_POINTS } from "@/lib/curriculum/starting-points";
import { getProfile } from "@/lib/profile";

export default async function OnboardingPage() {
  const { userId } = await requireAal2();
  const profile = await getProfile(userId);
  if (profile?.onboarded_at) redirect("/home");

  const t = await getTranslations("Onboarding");
  const b = await getTranslations("Buddy");
  const d = await getTranslations("Desktop");
  const groups = groupByPhase().map((g) => ({
    phase: g.phase,
    options: g.points.map((p) => ({
      seq: p.seq,
      label: `${p.code} · ${p.theme && p.theme !== "—" ? p.theme : p.grammar}`,
    })),
  }));
  return (
    <AuthLayout formTitle={d("heading.onboarding")} title={t("title")} line={b("letsStart.de")} helper={b("letsStart.en")} intro={t("intro")} pose="talking">
      <OnboardingForm groups={groups} defaultSeq={STARTING_POINTS[0].seq} needsTerms={!profile?.terms_accepted_at} />
    </AuthLayout>
  );
}
