import { getTranslations } from "next-intl/server";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { ResetPasswordForm } from "@/components/AuthForms";
import { requireSession } from "@/lib/auth/guard";

export default async function ResetPasswordPage() {
  await requireSession();
  const t = await getTranslations("Reset");
  const b = await getTranslations("Buddy");
  return (
    <AuthLayout title={t("title")} line={b("almostThere.de")} helper={b("almostThere.en")} pose="neutral">
      <ResetPasswordForm />
    </AuthLayout>
  );
}
