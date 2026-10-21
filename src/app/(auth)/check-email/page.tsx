import { getTranslations } from "next-intl/server";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { PillButton } from "@/components/ds";

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("CheckEmail");
  const b = await getTranslations("Buddy");
  const d = await getTranslations("Desktop");
  const { type } = await searchParams;
  return (
    <AuthLayout formTitle={d("heading.checkEmail")} title={t("title")} line={b("mailForYou.de")} helper={b("mailForYou.en")} pose="happy">
      <p>{type === "reset" ? t("reset") : t("confirm")}</p>
      <p className="text-muted">{t("spam")}</p>
      <PillButton href="/login" variant="cushion" fullWidth>
        {t("toLogin")}
      </PillButton>
    </AuthLayout>
  );
}
