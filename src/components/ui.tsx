import Link from "next/link";
import { useTranslations } from "next-intl";

export const linkClass = "font-bold text-text underline underline-offset-2";

export function LegalLinks() {
  const t = useTranslations("Common");
  return (
    <nav aria-label="Legal" className="flex flex-wrap justify-center gap-x-5 text-sm text-muted">
      <Link href="/impressum" className="inline-flex min-h-11 min-w-11 items-center justify-center underline underline-offset-2">
        {t("legalImpressum")}
      </Link>
      <Link href="/datenschutz" className="inline-flex min-h-11 min-w-11 items-center justify-center underline underline-offset-2">
        {t("legalPrivacy")}
      </Link>
      <Link href="/terms" className="inline-flex min-h-11 min-w-11 items-center justify-center underline underline-offset-2">
        {t("legalTerms")}
      </Link>
    </nav>
  );
}
