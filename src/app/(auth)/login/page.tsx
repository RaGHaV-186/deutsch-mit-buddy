import { getTranslations } from "next-intl/server";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { LoginForm } from "@/components/AuthForms";
import { safeNextPath } from "@/lib/auth/next-path";

const URL_ERRORS = new Set(["oauth", "link", "link_device", "rate_limited", "unavailable"]);

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("LogIn");
  const b = await getTranslations("Buddy");
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeNextPath(params.next, "") : "";
  const error = typeof params.error === "string" && URL_ERRORS.has(params.error) ? params.error : undefined;
  return (
    <AuthLayout title={t("title")} line={b("welcomeBack.de")} helper={b("welcomeBack.en")} pose="neutral">
      <LoginForm next={next || undefined} initialError={error} />
    </AuthLayout>
  );
}
