import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { signOutAction } from "@/app/(auth)/actions";
import { MfaVerifyForm } from "@/components/MfaForms";
import { AuthShell, linkClass } from "@/components/ui";
import { requireSession } from "@/lib/auth/guard";
import { safeNextPath } from "@/lib/auth/next-path";
import { createClient } from "@/lib/supabase/server";

export default async function MfaVerifyPage({
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
  if ((data?.totp?.length ?? 0) === 0) redirect("/mfa/setup");

  const t = await getTranslations("Mfa");
  return (
    <AuthShell title={t("verifyTitle")} subtitle={t("verifyIntro")}>
      <MfaVerifyForm next={next || undefined} />
      <form action={signOutAction}>
        <button type="submit" className={linkClass}>
          {t("signOut")}
        </button>
      </form>
    </AuthShell>
  );
}
