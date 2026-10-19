import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { OnboardingForm } from "@/components/OnboardingForm";
import { AuthShell } from "@/components/ui";
import { requireAal2 } from "@/lib/auth/guard";
import { groupByPhase, STARTING_POINTS } from "@/lib/curriculum/starting-points";
import { getProfile } from "@/lib/profile";

export default async function OnboardingPage() {
  const { userId } = await requireAal2();
  const profile = await getProfile(userId);
  if (profile?.onboarded_at) redirect("/home");

  const t = await getTranslations("Onboarding");
  const groups = groupByPhase().map((g) => ({
    phase: g.phase,
    options: g.points.map((p) => ({
      seq: p.seq,
      label: `${p.code} · ${p.theme && p.theme !== "—" ? p.theme : p.grammar}`,
    })),
  }));
  return (
    <AuthShell title={t("title")} subtitle={t("intro")}>
      <OnboardingForm groups={groups} defaultSeq={STARTING_POINTS[0].seq} needsTerms={!profile?.terms_accepted_at} />
    </AuthShell>
  );
}
