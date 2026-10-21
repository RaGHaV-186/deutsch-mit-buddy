import { getTranslations } from "next-intl/server";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { ForgotPasswordForm } from "@/components/AuthForms";

export default async function ForgotPasswordPage() {
  const t = await getTranslations("Forgot");
  const b = await getTranslations("Buddy");
  return (
    <AuthLayout title={t("title")} line={b("noProblem.de")} helper={b("noProblem.en")} intro={t("subtitle")} pose="curious">
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
