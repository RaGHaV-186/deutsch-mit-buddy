import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { LegalLinks, primaryButtonClass, secondaryButtonClass } from "@/components/ui";

export default function Home() {
  const t = useTranslations("Home");
  return (
    <>
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center">
        <Image src="/buddy/buddy-happy.svg" alt={t("buddyAlt")} width={240} height={244} priority />
        <h1 className="font-heading text-4xl font-bold sm:text-5xl">{t("greeting")}</h1>
        <p className="max-w-md text-lg text-muted">{t("tagline")}</p>
        <div className="flex w-full max-w-xs flex-col gap-3">
          <Link href="/signup" className={`${primaryButtonClass} text-center`}>
            {t("signUp")}
          </Link>
          <Link href="/login" className={`${secondaryButtonClass} text-center`}>
            {t("logIn")}
          </Link>
        </div>
      </main>
      <footer className="px-4 py-6">
        <LegalLinks />
      </footer>
    </>
  );
}
