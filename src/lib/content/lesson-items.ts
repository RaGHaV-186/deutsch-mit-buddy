import type { z } from "zod";
import {
  cardSchema,
  closingSchema,
  cultureSchema,
  drillSchema,
  examListeningSchema,
  examPassageSchema,
  examSpeakingSchema,
  examWritingSchema,
  exampleSchema,
  goalSchema,
  grammarIntroSchema,
  listeningPassageSchema,
  missionSchema,
  passageSchema,
  phraseSchema,
  pronunciationSchema,
  questionSchema,
  tandemSchema,
  tableSchema,
  trapSchema,
  warmupPreviewSchema,
  writingSchema,
  type Lesson,
  type PartName,
} from "./lesson-schema.ts";

// A lesson is reviewed item by item. An item is one small unit (a card, an exercise, a reading passage, the writing
// task ...) with a stable id such as "Z1#vocabulary.w05". A correction replaces exactly that unit.

export const UNIT_SCHEMAS = {
  goal: goalSchema,
  question: questionSchema,
  card: cardSchema,
  phrase: phraseSchema,
  example: exampleSchema,
  trap: trapSchema,
  table: tableSchema,
  warmupPreview: warmupPreviewSchema,
  grammarIntro: grammarIntroSchema,
  pronunciation: pronunciationSchema,
  readingPassage: passageSchema,
  listeningPassage: listeningPassageSchema,
  writing: writingSchema,
  drill: drillSchema,
  tandem: tandemSchema,
  culture: cultureSchema,
  mission: missionSchema,
  examReadingPassage: examPassageSchema,
  examListeningPassage: examListeningSchema,
  examWriting: examWritingSchema,
  examSpeaking: examSpeakingSchema,
  closing: closingSchema,
} as const satisfies Record<string, z.ZodType>;
export type UnitName = keyof typeof UNIT_SCHEMAS;

export type Pointer = (string | number)[];
export interface LessonItem {
  id: string;
  part: PartName;
  unit: UnitName;
  pointer: Pointer;
  /** A short human label for lists. */
  label: string;
}

const pad = (n: number) => String(n + 1).padStart(2, "0");

export function getAt(root: unknown, pointer: Pointer): unknown {
  return pointer.reduce<unknown>((node, key) => (node as Record<string | number, unknown>)?.[key], root);
}
export function setAt<T>(root: T, pointer: Pointer, value: unknown): T {
  const copy = structuredClone(root) as Record<string | number, unknown>;
  let node = copy;
  pointer.slice(0, -1).forEach((key) => (node = node[key] as Record<string | number, unknown>));
  node[pointer[pointer.length - 1]] = value;
  return copy as T;
}

/** Every reviewable unit of a lesson, in lesson order. */
export function enumerateItems(code: string, lesson: Lesson): LessonItem[] {
  const items: LessonItem[] = [];
  const add = (part: PartName, suffix: string, unit: UnitName, pointer: Pointer, label: string) => items.push({ id: `${code}#${part}${suffix ? "." + suffix : ""}`, part, unit, pointer, label });

  add("goal", "", "goal", ["goal"], "Can-do goal");
  if (lesson.warmup.preview.points.length) add("warmup", "preview", "warmupPreview", ["warmup", "preview"], "Today you'll learn");
  lesson.warmup.items.forEach((_, i) => add("warmup", `q${pad(i)}`, "question", ["warmup", "items", i], `Warm-up ${i + 1}`));
  add("grammar", "intro", "grammarIntro", ["grammar", "intro"], "Grammar explanation");
  lesson.grammar.tables.forEach((t, i) => add("grammar", `tbl${i + 1}`, "table", ["grammar", "tables", i], `Table: ${t.title}`));
  lesson.grammar.examples.forEach((_, i) => add("grammar", `ex${i + 1}`, "example", ["grammar", "examples", i], `Example ${i + 1}`));
  lesson.grammar.traps.forEach((_, i) => add("grammar", `trap${i + 1}`, "trap", ["grammar", "traps", i], `Trap ${i + 1}`));
  lesson.exercises.items.forEach((_, i) => add("exercises", pad(i), "question", ["exercises", "items", i], `Exercise ${i + 1}`));
  lesson.vocabulary.words.forEach((c, i) => add("vocabulary", `w${pad(i)}`, "card", ["vocabulary", "words", i], `Word: ${c.de}`));
  lesson.vocabulary.phrases.forEach((p, i) => add("vocabulary", `p${i + 1}`, "phrase", ["vocabulary", "phrases", i], `Phrase: ${p.de}`));
  add("pronunciation", "", "pronunciation", ["pronunciation"], "Pronunciation focus");
  add("reading", "passage", "readingPassage", ["reading", "passage"], "Reading text");
  lesson.reading.questions.forEach((_, i) => add("reading", `q${i + 1}`, "question", ["reading", "questions", i], `Reading question ${i + 1}`));
  add("listening", "passage", "listeningPassage", ["listening", "passage"], "Listening dialogue");
  lesson.listening.questions.forEach((_, i) => add("listening", `q${i + 1}`, "question", ["listening", "questions", i], `Listening question ${i + 1}`));
  add("writing", "", "writing", ["writing"], "Writing task");
  lesson.speaking.drill.forEach((_, i) => add("speaking", `d${i + 1}`, "drill", ["speaking", "drill", i], `Speaking drill ${i + 1}`));
  add("speaking", "tandem", "tandem", ["speaking", "tandem"], "Tandem scenario");
  add("culture", "", "culture", ["culture"], "Culture note");
  add("mission", "", "mission", ["mission"], "Real-world mission");
  lesson.exam.grammar_vocab.forEach((_, i) => add("exam", `gv${i + 1}`, "question", ["exam", "grammar_vocab", i], `Exam grammar/vocabulary ${i + 1}`));
  add("exam", "reading.passage", "examReadingPassage", ["exam", "reading", "passage"], "Exam reading text");
  lesson.exam.reading.questions.forEach((_, i) => add("exam", `reading.q${i + 1}`, "question", ["exam", "reading", "questions", i], `Exam reading question ${i + 1}`));
  add("exam", "listening.passage", "examListeningPassage", ["exam", "listening", "passage"], "Exam listening dialogue");
  lesson.exam.listening.questions.forEach((_, i) => add("exam", `listening.q${i + 1}`, "question", ["exam", "listening", "questions", i], `Exam listening question ${i + 1}`));
  add("exam", "writing", "examWriting", ["exam", "writing"], "Exam writing task");
  add("exam", "speaking", "examSpeaking", ["exam", "speaking"], "Exam speaking task");
  add("closing", "", "closing", ["closing"], "Close day");
  return items;
}

export const valueOf = (lesson: Lesson, item: LessonItem) => getAt(lesson, item.pointer);

/** Replaces one unit with a correction. Returns null if the correction is not valid JSON or does not fit the unit's schema. */
export function applyFix(lesson: Lesson, item: LessonItem, fixedJson: string): { lesson: Lesson; value: unknown } | null {
  let raw: unknown;
  try {
    raw = JSON.parse(fixedJson);
  } catch {
    return null;
  }
  const parsed = UNIT_SCHEMAS[item.unit].safeParse(raw);
  if (!parsed.success) return null;
  return { lesson: setAt(lesson, item.pointer, parsed.data), value: parsed.data };
}
