import { z } from "zod";

// What the generator (Sonnet) writes and the reviewer (Opus) judges, one lesson at a time.
// Relative imports only: the generation scripts run these files with plain Node.

export const ARTICLES = ["der", "die", "das"] as const;
export const SKILLS = ["vocabulary", "articles", "grammar", "word_order", "translation"] as const;
export const QUESTION_TYPES = ["multiple_choice", "gap_fill", "ordering", "typing"] as const;
export const TIERS = ["core", "bonus"] as const;
export const VERDICTS = ["ok", "fixed", "needs-human"] as const;

/** The 12 questions a lesson gets (what each skill tests, and in which format). */
export const QUESTION_PLAN: { skill: (typeof SKILLS)[number]; type: (typeof QUESTION_TYPES)[number]; count: number }[] = [
  { skill: "vocabulary", type: "multiple_choice", count: 3 },
  { skill: "articles", type: "multiple_choice", count: 3 },
  { skill: "grammar", type: "gap_fill", count: 3 },
  { skill: "word_order", type: "ordering", count: 1 },
  { skill: "translation", type: "typing", count: 2 },
];
export const QUESTIONS_PER_LESSON = QUESTION_PLAN.reduce((n, p) => n + p.count, 0);

const text = (max: number) => z.string().trim().min(1).max(max);
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

export const generatedCardSchema = z.object({
  tier: z.enum(TIERS),
  en: text(300),
  article: z.enum(ARTICLES).nullish().transform((v) => v ?? null),
  de: text(300),
  plural: optional(200),
  example: text(300),
  example_en: text(300),
  tip: optional(300),
});
export type GeneratedCard = z.output<typeof generatedCardSchema>;

export const generatedQuestionSchema = z.object({
  skill: z.enum(SKILLS),
  type: z.enum(QUESTION_TYPES),
  prompt: text(500),
  answer: text(300),
  distractors: z.array(text(300)).max(6),
  explanation: text(400),
});
export type GeneratedQuestion = z.output<typeof generatedQuestionSchema>;

export const lessonContentSchema = z.object({
  cards: z.array(generatedCardSchema).min(1).max(40),
  questions: z.array(generatedQuestionSchema).min(1).max(40),
});
export type LessonContent = z.output<typeof lessonContentSchema>;

export const verdictSchema = z.object({
  id: text(40),
  status: z.enum(VERDICTS),
  reason: text(400),
  fixed_card: generatedCardSchema.nullish().transform((v) => v ?? null),
  fixed_question: generatedQuestionSchema.nullish().transform((v) => v ?? null),
});
export type Verdict = z.output<typeof verdictSchema>;

export const reviewResultSchema = z.object({ verdicts: z.array(verdictSchema).min(1).max(80) });
export type ReviewResult = z.output<typeof reviewResultSchema>;

// ---- JSON Schemas sent to the API as structured output (hand-written: the API accepts only a subset of JSON Schema,
// so length limits and counts are checked by the zod schemas above after the response arrives).

const str = { type: "string" } as const;
const nullableStr = { anyOf: [{ type: "string" }, { type: "null" }] } as const;
const strEnum = (values: readonly string[]) => ({ type: "string", enum: [...values] });

export const CARD_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["tier", "en", "article", "de", "plural", "example", "example_en", "tip"],
  properties: {
    tier: strEnum(TIERS),
    en: str,
    article: { anyOf: [strEnum(ARTICLES), { type: "null" }] },
    de: str,
    plural: nullableStr,
    example: str,
    example_en: str,
    tip: nullableStr,
  },
} as const;

export const QUESTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["skill", "type", "prompt", "answer", "distractors", "explanation"],
  properties: {
    skill: strEnum(SKILLS),
    type: strEnum(QUESTION_TYPES),
    prompt: str,
    answer: str,
    distractors: { type: "array", items: str },
    explanation: str,
  },
} as const;

export const GENERATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["cards", "questions"],
  properties: {
    cards: { type: "array", items: CARD_JSON_SCHEMA },
    questions: { type: "array", items: QUESTION_JSON_SCHEMA },
  },
} as const;

export const REVIEW_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["verdicts"],
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "status", "reason", "fixed_card", "fixed_question"],
        properties: {
          id: str,
          status: strEnum(VERDICTS),
          reason: str,
          fixed_card: { anyOf: [CARD_JSON_SCHEMA, { type: "null" }] },
          fixed_question: { anyOf: [QUESTION_JSON_SCHEMA, { type: "null" }] },
        },
      },
    },
  },
} as const;

// ---- Item ids: stable names for every card and question of a lesson, used in the review file.
export const cardId = (code: string, index: number) => `${code}#c${String(index + 1).padStart(2, "0")}`;
export const questionId = (code: string, index: number) => `${code}#q${String(index + 1).padStart(2, "0")}`;
export const isCardId = (id: string) => /#c\d+$/.test(id);
