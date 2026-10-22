import { SESSIONS } from "@data/curriculum";
import { getTranslations } from "next-intl/server";
import { HomeView } from "@/components/home/HomeView";
import { requireAal2 } from "@/lib/auth/guard";
import { homeLine, lessonTitle } from "@/lib/buddy-lines";
import { ensureLessonCards } from "@/lib/cards/ensure-unlocked";
import { getDueCounts } from "@/lib/cards/server";
import { gameDataForHome } from "@/lib/game-layer";
import { getProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { safeTimeZone } from "@/lib/time";

export default async function HomePage() {
  const { userId } = await requireAal2();
  const profile = await getProfile(userId);
  const b = await getTranslations("Buddy.home");
  const session = profile ? SESSIONS[profile.session_seq] : undefined;
  const dayCount = profile?.day_count ?? 1;
  const line = homeLine(session, dayCount);
  const timeZone = safeTimeZone(profile?.timezone);
  const now = new Date();
  // The layout unlocks too; this shares its promise, so the counts below see the new cards.
  await ensureLessonCards(userId);
  const counts = await getDueCounts(await createClient(), userId, now, timeZone);
  // Only the desktop hero shows it. German, because Buddy greets in German (the interface labels stay English).
  const dateLabel = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone }).format(now);

  return (
    <HomeView
      name={profile?.display_name ?? null}
      line={b(line.key, { theme: line.theme ?? "" })}
      lesson={session ? { day: dayCount, code: session.code, title: lessonTitle(session) } : null}
      due={counts ? counts.due + counts.fresh : 0}
      dueDetail={counts ? { reviews: counts.due, fresh: counts.fresh } : undefined}
      dateLabel={dateLabel}
      game={gameDataForHome()}
    />
  );
}
