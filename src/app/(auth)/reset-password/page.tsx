import { getTranslations } from "next-intl/server";
import { ResetPasswordForm } from "@/components/AuthForms";
import { AuthShell } from "@/components/ui";
import { requireSession } from "@/lib/auth/guard";

export default async function ResetPasswordPage() {
  await requireSession();
  const t = await getTranslations("Reset");
  return (
    <AuthShell title={t("title")}>
      <ResetPasswordForm />
    </AuthShell>
  );
}
