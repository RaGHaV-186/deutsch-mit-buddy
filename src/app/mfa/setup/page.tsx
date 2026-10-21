import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { TotpSetup } from "@/components/MfaForms";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { requireSession } from "@/lib/auth/guard";
import { safeNextPath } from "@/lib/auth/next-path";
import { createClient } from "@/lib/supabase/server";

export default async function MfaSetupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const state = await requireSession();
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeNextPath(params.next, "") : "";
  if (state.status === "aal2") redirect(next || "/home");

  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  if ((data?.totp?.length ?? 0) > 0) redirect("/mfa/verify");

  const t = await getTranslations("Mfa");
  const b = await getTranslations("Buddy");
  const d = await getTranslations("Desktop");
  return (
    <AuthLayout formTitle={d("heading.mfaSetup")} title={t("setupTitle")} line={b("oneMoreStep.de")} helper={b("oneMoreStep.en")} intro={t("setupIntro")} pose="listening">
      <TotpSetup next={next || undefined} />
    </AuthLayout>
  );
}
