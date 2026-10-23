import { SESSIONS } from "@data/curriculum";
import { LearnView, type LearnLesson } from "@/components/learn/LearnView";
import { requireAal2FromClaims } from "@/lib/auth/guard";
import { lessonTitle } from "@/lib/buddy-lines";
import { ensureLessonCardsIfNew } from "@/lib/cards/ensure-unlocked";
import { getLessonCardCounts, getPublishedLesson } from "@/lib/lessons/server";
import { getProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export default async function LearnPage() {
  const { userId } = await requireAal2FromClaims();
  const profile = await getProfile(userId);
  const session = profile ? SESSIONS[profile.session_seq] : undefined;
  if (!profile || !session || session.kind !== "lesson") return <LearnView lesson={null} kind="other" />;

  // New lessons may have been published since the learner last came: copy their cards in before counting them.
  await ensureLessonCardsIfNew(userId, profile);
  const db = await createClient();
  const [content, cards] = await Promise.all([getPublishedLesson(db, session.code), getLessonCardCounts(db, userId, session.code)]);
  const lesson: LearnLesson = {
    day: profile.day_count,
    code: session.code,
    title: lessonTitle(session),
    grammar: session.grammar,
    goal: content?.goal.can_do ?? null,
    published: content !== null,
    cards,
  };
  return <LearnView lesson={lesson} kind="lesson" />;
}
