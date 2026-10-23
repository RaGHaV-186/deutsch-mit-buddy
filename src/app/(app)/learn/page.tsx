import { SESSIONS } from "@data/curriculum";
import { LearnView, type LearnLesson } from "@/components/learn/LearnView";
import { requireAal2 } from "@/lib/auth/guard";
import { lessonTitle } from "@/lib/buddy-lines";
import { ensureLessonCards } from "@/lib/cards/ensure-unlocked";
import { getLessonCardCounts, getPublishedLesson } from "@/lib/lessons/server";
import { getProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export default async function LearnPage() {
  const { userId } = await requireAal2();
  const profile = await getProfile(userId);
  const session = profile ? SESSIONS[profile.session_seq] : undefined;
  if (!profile || !session || session.kind !== "lesson") return <LearnView lesson={null} kind="other" />;

  // New lessons may have been published since the learner last came: copy their cards in before counting them.
  await ensureLessonCards(userId);
  const db = await createClient();
  const content = await getPublishedLesson(db, session.code);
  const lesson: LearnLesson = {
    day: profile.day_count,
    code: session.code,
    title: lessonTitle(session),
    grammar: session.grammar,
    goal: content?.goal.can_do ?? null,
    published: content !== null,
    cards: await getLessonCardCounts(db, userId, session.code),
  };
  return <LearnView lesson={lesson} kind="lesson" />;
}
