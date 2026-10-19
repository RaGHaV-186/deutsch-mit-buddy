import { SESSIONS } from "@data/curriculum";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { requireAal2 } from "@/lib/auth/guard";
import { getProfile } from "@/lib/profile";

export default async function HomePage() {
  const { userId } = await requireAal2();
  const profile = await getProfile(userId);
  const t = await getTranslations("App");
  const session = profile ? SESSIONS[profile.session_seq] : undefined;
  const name = profile?.display_name;
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-5 px-4 py-8 text-center">
      <Image src="/buddy/buddy-happy.svg" alt="" width={160} height={163} priority />
      <h1 className="font-heading text-3xl font-bold">{name ? t("hello", { name }) : t("helloNoName")}</h1>
      {session ? (
        <section className="flex flex-col gap-1 rounded-xl border border-foreground/20 p-4">
          <p className="text-sm text-muted">{t("today")}</p>
          <p className="font-heading text-xl font-bold">
            {t("day", { day: profile!.day_count })} · {session.code}
          </p>
          <p>{session.theme !== "—" ? session.theme : session.grammar}</p>
        </section>
      ) : null}
      <p className="max-w-md text-muted">{t("soon")}</p>
    </main>
  );
}
