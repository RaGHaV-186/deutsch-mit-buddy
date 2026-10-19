import { SESSIONS } from "@data/curriculum";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireAal2 } from "@/lib/auth/guard";
import { getDueCounts } from "@/lib/cards/server";
import { getProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { safeTimeZone } from "@/lib/time";
import { primaryButtonClass } from "@/components/ui";

export default async function HomePage() {
  const { userId } = await requireAal2();
  const profile = await getProfile(userId);
  const t = await getTranslations("App");
  const session = profile ? SESSIONS[profile.session_seq] : undefined;
  const name = profile?.display_name;
  const counts = await getDueCounts(await createClient(), userId, new Date(), safeTimeZone(profile?.timezone));
  const waiting = counts ? counts.due + counts.fresh : 0;
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
      <Link href="/cards" className={`${primaryButtonClass} block max-w-xs text-center`}>
        {waiting > 0 ? t("cardsDue", { count: waiting }) : t("cardsOpen")}
      </Link>
      <p className="max-w-md text-muted">{t("soon")}</p>
    </main>
  );
}
