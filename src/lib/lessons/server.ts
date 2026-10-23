import type { SupabaseClient } from "@supabase/supabase-js";
import { lessonSchema, PARTS, type Lesson } from "@/lib/content/lesson-schema";

/** One lesson as the learner reads it: the 14 published parts. Null when the lesson is not published (row-level security hides unpublished parts) or a part is damaged. */
export async function getPublishedLesson(db: SupabaseClient, code: string): Promise<Lesson | null> {
  const { data, error } = await db.from("lesson_parts").select("part, content").eq("session_code", code);
  if (error || !data || data.length !== PARTS.length) return null;
  const parsed = lessonSchema.safeParse(Object.fromEntries(data.map((r) => [r.part as string, r.content])));
  return parsed.success ? parsed.data : null;
}

export interface LessonCardCounts {
  /** Cards of this lesson in the learner's deck. */
  total: number;
  /** Of those, never reviewed yet. */
  fresh: number;
}

/** How many of this lesson's cards the learner has, and how many are still new (their own rows only, by row-level security). */
export async function getLessonCardCounts(db: SupabaseClient, userId: string, code: string): Promise<LessonCardCounts> {
  const { data } = await db.from("cards").select("id, card_srs(last_reviewed_at)").eq("user_id", userId).eq("session_code", code).limit(200);
  const rows = (data ?? []) as { card_srs: { last_reviewed_at: string | null } | { last_reviewed_at: string | null }[] | null }[];
  const srsOf = (r: (typeof rows)[number]) => (Array.isArray(r.card_srs) ? r.card_srs[0] : r.card_srs);
  return { total: rows.length, fresh: rows.filter((r) => srsOf(r) && srsOf(r)!.last_reviewed_at === null).length };
}
