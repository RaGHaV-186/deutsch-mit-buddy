import { getTranslations } from "next-intl/server";
import { ForgotPasswordForm } from "@/components/AuthForms";
import { AuthShell } from "@/components/ui";

export default async function ForgotPasswordPage() {
  const t = await getTranslations("Forgot");
  return (
    <AuthShell title={t("title")} subtitle={t("subtitle")}>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
