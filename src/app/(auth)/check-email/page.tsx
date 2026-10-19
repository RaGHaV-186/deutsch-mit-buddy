import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthShell, linkClass } from "@/components/ui";

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("CheckEmail");
  const { type } = await searchParams;
  return (
    <AuthShell title={t("title")}>
      <p>{type === "reset" ? t("reset") : t("confirm")}</p>
      <p className="text-muted">{t("spam")}</p>
      <Link href="/login" className={linkClass}>
        {t("toLogin")}
      </Link>
    </AuthShell>
  );
}
