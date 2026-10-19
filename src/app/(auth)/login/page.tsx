import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/AuthForms";
import { AuthShell } from "@/components/ui";
import { safeNextPath } from "@/lib/auth/next-path";

const URL_ERRORS = new Set(["oauth", "link", "link_device", "rate_limited"]);

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("LogIn");
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeNextPath(params.next, "") : "";
  const error = typeof params.error === "string" && URL_ERRORS.has(params.error) ? params.error : undefined;
  return (
    <AuthShell title={t("title")} subtitle={t("subtitle")}>
      <LoginForm next={next || undefined} initialError={error} />
    </AuthShell>
  );
}
