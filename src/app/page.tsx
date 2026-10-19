import Image from "next/image";
import { useTranslations } from "next-intl";

export default function Home() {
  const t = useTranslations("Home");
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      <Image
        src="/buddy/buddy-happy.svg"
        alt={t("buddyAlt")}
        width={240}
        height={244}
        priority
      />
      <h1 className="font-heading text-4xl font-bold sm:text-5xl">
        {t("greeting")}
      </h1>
      <p className="max-w-md text-lg text-muted">{t("tagline")}</p>
    </main>
  );
}
