import { z } from "zod";
import { normalise } from "./answer-check.ts";

// The lesson standard (BLUEPRINT section 1): every session has all 14 parts. These schemas are the single description of a
// lesson. They are used to (1) tell the model what to write (as a JSON Schema), (2) check what came back, and
// (3) check what the Opus reviewer corrected. Relative imports only: the scripts run this file with plain Node.

export const PARTS = ["goal", "warmup", "grammar", "exercises", "vocabulary", "pronunciation", "reading", "listening", "writing", "speaking", "culture", "mission", "exam", "closing"] as const;
export type PartName = (typeof PARTS)[number];
/** Part number in the standard (0 = can-do goal ... 13 = close day). */
export const PART_NUMBER: Record<PartName, number> = Object.fromEntries(PARTS.map((p, i) => [p, i])) as Record<PartName, number>;
/**
 * A lesson is written in four Sonnet passes (the API's structured-output grammar is too large for more parts at once; each schema was
 * probed against the real API and pass C with the warm-up in it was refused):
 * pass A teaches (goal, grammar, exercises, vocabulary, pronunciation); pass B covers reading, listening, writing and speaking;
 * pass C is the day exam; pass D covers the warm-up, the culture note, the mission and close day. Passes B, C and D see pass A's grammar
 * and words; pass D also sees the grammar and words of the EARLIER sessions, because the warm-up reviews those, never this lesson's own content.
 */
export const PASS_A_PARTS = ["goal", "grammar", "exercises", "vocabulary", "pronunciation"] as const satisfies readonly PartName[];
export const PASS_B_PARTS = ["reading", "listening", "writing", "speaking"] as const satisfies readonly PartName[];
export const PASS_C_PARTS = ["exam"] as const satisfies readonly PartName[];
export const PASS_D_PARTS = ["warmup", "culture", "mission", "closing"] as const satisfies readonly PartName[];

export const ARTICLES = ["der", "die", "das"] as const;
export const TIERS = ["core", "bonus"] as const;
export const SKILLS = ["vocabulary", "articles", "grammar", "word_order", "translation", "dictation", "reading", "listening"] as const;
export const QUESTION_TYPES = ["multiple_choice", "gap_fill", "ordering", "typing", "dictation"] as const;
export const VERDICTS = ["ok", "fixed", "needs-human"] as const;
export type Verdict = (typeof VERDICTS)[number];

// How many of everything a lesson has (checked by the automatic lint, not by the schema, so one miscount
// never throws away a whole paid lesson).
export const COUNTS = {
  wordsCore: 12,
  wordsBonus: 6,
  wordsTotal: [15, 20] as const,
  phrases: 5,
  /** A lesson note (lesson-notes.ts) may ask for extra phrases, never more than this. */
  phrasesMax: 7,
  warmup: 3,
  /** Lesson 1 has nothing to review yet: it opens with a short "Today you'll learn ..." preview instead. */
  warmupPreview: [3, 5] as const,
  tables: [0, 3] as const,
  examples: [5, 6] as const,
  traps: [2, 4] as const,
  exercises: { gap_fill: 6, multiple_choice: 4, ordering: 3, typing: 3, dictation: 3 } as Record<string, number>,
  pronunciationWords: [6, 8] as const,
  pronunciationSentences: [3, 4] as const,
  readingQuestions: 5,
  listeningQuestions: 5,
  scriptLines: [6, 14] as const,
  drill: 5,
  mustInclude: [3, 5] as const,
  usefulPhrases: [3, 5] as const,
  rubric: [4, 5] as const,
  examGrammarVocab: 6,
  examReadingQuestions: 2,
  examListeningQuestions: 2,
  examScriptLines: [2, 4] as const,
  closingCovered: [3, 5] as const,
};
export const EXERCISES_PER_LESSON = Object.values(COUNTS.exercises).reduce((a, b) => a + b, 0);

// ---- Level profiles: how instructions and tasks change from level to level.
export type Phase = "zero" | "A1" | "A2" | "B1" | "exam" | "B2" | "C1";
export interface LevelProfile {
  cefr: "A1" | "A2" | "B1" | "B2" | "C1";
  /** What the explanations and instructions are written in. */
  instructionLanguage: string;
  /** Allowed share of German in the instruction-language fields (0 = all English, 1 = all German). */
  germanShare: readonly [number, number];
  readingWords: readonly [number, number];
  listeningWords: readonly [number, number];
  writingMinWords: readonly [number, number];
  writingKind: string;
  dictationMaxWords: number;
}
export const LEVEL_PROFILES: Record<Phase, LevelProfile> = {
  zero: { cefr: "A1", instructionLanguage: "English only (German appears only in examples and the words being taught)", germanShare: [0, 0.25], readingWords: [25, 70], listeningWords: [30, 80], writingMinWords: [20, 40], writingKind: "3 to 5 short sentences", dictationMaxWords: 6 },
  A1: { cefr: "A1", instructionLanguage: "English (German appears in examples and in the words being taught)", germanShare: [0, 0.3], readingWords: [40, 90], listeningWords: [40, 100], writingMinWords: [30, 60], writingKind: "a short message or postcard", dictationMaxWords: 8 },
  A2: { cefr: "A2", instructionLanguage: "mostly English; exercise instructions in very simple German with the key word in English where needed", germanShare: [0.1, 0.55], readingWords: [80, 150], listeningWords: [80, 160], writingMinWords: [60, 90], writingKind: "a message, postcard or short note", dictationMaxWords: 10 },
  B1: { cefr: "B1", instructionLanguage: "mostly German; English only for hints inside grammar explanations", germanShare: [0.4, 0.95], readingWords: [150, 300], listeningWords: [150, 300], writingMinWords: [100, 150], writingKind: "an email or an opinion text", dictationMaxWords: 12 },
  exam: { cefr: "B1", instructionLanguage: "mostly German; English only for hints inside strategy explanations", germanShare: [0.5, 1], readingWords: [150, 300], listeningWords: [150, 300], writingMinWords: [60, 150], writingKind: "an exam-style email or forum post", dictationMaxWords: 12 },
  B2: { cefr: "B2", instructionLanguage: "German only", germanShare: [0.85, 1], readingWords: [250, 450], listeningWords: [250, 400], writingMinWords: [150, 220], writingKind: "an argument or a formal letter", dictationMaxWords: 15 },
  C1: { cefr: "C1", instructionLanguage: "German only", germanShare: [0.9, 1], readingWords: [400, 700], listeningWords: [350, 600], writingMinWords: [250, 350], writingKind: "an essay or a presentation text", dictationMaxWords: 18 },
};

// ---- Units: the small pieces the reviewer judges one by one.
const text = (max: number) => z.string().trim().min(1).max(max);
const maybe = (max: number) => z.string().trim().max(max).nullable();

/** Question types whose answer the learner writes or arranges: only these may list accepted_answers. */
export const WRITTEN_TYPES = ["typing", "ordering", "dictation"] as const;

export const questionSchema = z.object({
  skill: z.enum(SKILLS),
  type: z.enum(QUESTION_TYPES),
  prompt: text(500),
  answer: text(300),
  distractors: z.array(text(300)).max(6),
  /**
   * Other natural, correct answers for typing, translation, dictation and ordering questions (the checker in answer-check.ts normalises
   * case, punctuation and ß/ss, so these are only real alternatives such as "Mein Name ist Jonas." next to "Ich heiße Jonas.").
   * Empty for choice questions. Defaults to empty so content written before this field existed still parses.
   */
  accepted_answers: z.array(text(300)).max(8).default([]),
  explanation: text(400),
});
export const cardSchema = z.object({
  tier: z.enum(TIERS),
  en: text(300),
  article: z.enum(ARTICLES).nullable(),
  de: text(300),
  plural: maybe(200),
  example: text(300),
  example_en: text(300),
  tip: maybe(300),
});
export const phraseSchema = z.object({ en: text(300), de: text(300), example: text(300), example_en: text(300), tip: maybe(300) });
export const exampleSchema = z.object({ de: text(300), en: text(300), note: maybe(300) });
/** A support table in a grammar part: the alphabet, a conjugation, the articles, an endings chart. */
export const tableSchema = z.object({ title: text(120), headers: z.array(text(60)).min(1).max(8), rows: z.array(z.array(text(120)).min(1).max(8)).min(1).max(40) });
export const warmupPreviewSchema = z.object({ points: z.array(text(200)).max(6) });
export const trapSchema = z.object({ wrong: text(300), right: text(300), why: text(400) });
export const scriptLineSchema = z.object({ speaker: text(30), de: text(400), en: maybe(400) });

export const goalSchema = z.object({ can_do: text(300) });
export const grammarIntroSchema = z.object({ title: text(120), explanation: z.array(text(900)).min(1).max(6), rule_summary: text(300) });
export const pronunciationSchema = z.object({
  focus: text(120),
  explanation: text(700),
  words: z.array(z.object({ de: text(100), hint: text(200) })).min(1).max(12),
  sentences: z.array(text(200)).min(1).max(8),
});
export const passageSchema = z.object({ title: text(120), text: text(3500) });
export const listeningPassageSchema = z.object({ title: text(120), speakers: z.array(text(30)).min(2).max(4), script: z.array(scriptLineSchema).min(2).max(30) });
export const writingSchema = z.object({
  task: text(600),
  min_words: z.number().int().min(5).max(600),
  must_include: z.array(text(200)).min(1).max(8),
  useful_phrases: z.array(text(200)).min(1).max(8),
  model_answer: text(2500),
  rubric: z.array(text(300)).min(1).max(8),
});
export const drillSchema = z.object({ prompt: text(300), target: text(300), tip: maybe(200) });
export const tandemSchema = z.object({
  title: text(120),
  setting: text(400),
  buddy_role: text(200),
  learner_role: text(200),
  opening_line: text(300),
  target_phrases: z.array(text(200)).min(1).max(8),
  target_grammar: text(300),
  topics: z.array(text(300)).min(2).max(10),
  end_condition: text(300),
});
export const cultureSchema = z.object({ title: text(120), note: text(1500), reflection_question: text(300) });
export const missionSchema = z.object({
  title: text(120),
  task: text(600),
  steps: z.array(text(300)).min(1).max(6),
  report_prompt: text(300),
  success_check: z.array(text(200)).min(1).max(5),
  safety_note: maybe(300),
});
export const examPassageSchema = z.object({ text: text(1200) });
export const examListeningSchema = z.object({ script: z.array(scriptLineSchema).min(1).max(10) });
export const examWritingSchema = z.object({ task: text(400), min_words: z.number().int().min(5).max(200), rubric: z.array(text(300)).min(1).max(6) });
export const examSpeakingSchema = z.object({ prompt: text(400), target_hint: maybe(300) });
export const closingSchema = z.object({ covered: z.array(text(200)).min(1).max(8), review_tomorrow: text(300) });

// ---- Parts
export const passASchema = z.object({
  goal: goalSchema,
  grammar: z.object({ intro: grammarIntroSchema, examples: z.array(exampleSchema).min(1).max(10), traps: z.array(trapSchema).min(1).max(6), tables: z.array(tableSchema).max(4).default([]) }),
  exercises: z.object({ items: z.array(questionSchema).min(1).max(40) }),
  vocabulary: z.object({ words: z.array(cardSchema).min(1).max(40), phrases: z.array(phraseSchema).min(1).max(12) }),
  pronunciation: pronunciationSchema,
});
export const passBSchema = z.object({
  reading: z.object({ passage: passageSchema, questions: z.array(questionSchema).min(1).max(12) }),
  listening: z.object({ passage: listeningPassageSchema, questions: z.array(questionSchema).min(1).max(12) }),
  writing: writingSchema,
  speaking: z.object({ drill: z.array(drillSchema).min(1).max(10), tandem: tandemSchema }),
});
export const passCSchema = z.object({
  exam: z.object({
    grammar_vocab: z.array(questionSchema).min(1).max(12),
    reading: z.object({ passage: examPassageSchema, questions: z.array(questionSchema).min(1).max(6) }),
    listening: z.object({ passage: examListeningSchema, questions: z.array(questionSchema).min(1).max(6) }),
    writing: examWritingSchema,
    speaking: examSpeakingSchema,
  }),
});
export const passDSchema = z.object({
  warmup: z.object({ preview: warmupPreviewSchema, items: z.array(questionSchema).max(8) }),
  culture: cultureSchema,
  mission: missionSchema,
  closing: closingSchema,
});
const partShapes = { ...passASchema.shape, ...passBSchema.shape, ...passCSchema.shape, ...passDSchema.shape };
// The parts in lesson order (goal ... close day), whichever pass wrote them.
export const lessonSchema = z.object(Object.fromEntries(PARTS.map((part) => [part, partShapes[part]])) as typeof partShapes);

export type PassA = z.output<typeof passASchema>;
export type PassB = z.output<typeof passBSchema>;
export type PassC = z.output<typeof passCSchema>;
export type PassD = z.output<typeof passDSchema>;
export type Lesson = z.output<typeof lessonSchema>;
export type Question = z.output<typeof questionSchema>;
export type Card = z.output<typeof cardSchema>;
export type Phrase = z.output<typeof phraseSchema>;

// ---- The reviewer's answer. A correction travels as a JSON string (so the API schema stays small) and is
// validated against the unit's own schema before it is accepted.
export const verdictSchema = z.object({
  id: text(60),
  status: z.enum(VERDICTS),
  reason: text(500),
  fixed_json: z.string().max(8000).nullable(),
});
export const reviewResultSchema = z.object({ verdicts: z.array(verdictSchema).min(1).max(250) });
export type ReviewVerdict = z.output<typeof verdictSchema>;

// ---- JSON Schema for the API's structured output. The API accepts only a subset of JSON Schema (no length or count limits) and
// refuses grammars that are too large, so: limits are stripped (the zod schemas and the lint enforce them after the answer arrives),
// and for the generation passes "nullable" is replaced by a plain string where "" (or "none" for an article) means nothing.
const UNSUPPORTED = new Set(["minLength", "maxLength", "minItems", "maxItems", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf", "pattern", "format", "default", "$schema", "title", "description", "examples"]);

export function toApiSchema(schema: z.ZodType, options: { simplifyNull?: boolean } = {}): Record<string, unknown> {
  const raw = z.toJSONSchema(schema, { io: "input", reused: "inline", unrepresentable: "throw" }) as Record<string, unknown>;
  const clean = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(clean);
    if (node && typeof node === "object") {
      const obj = node as Record<string, unknown>;
      const any = obj.anyOf;
      if (options.simplifyNull && Array.isArray(any) && any.length === 2 && any.some((x) => (x as { type?: string }).type === "null")) {
        const other = clean(any.find((x) => (x as { type?: string }).type !== "null")) as Record<string, unknown>;
        return Array.isArray(other.enum) ? { ...other, enum: [...other.enum, "none"] } : other;
      }
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (UNSUPPORTED.has(k) && typeof v !== "object") continue;
        if (k === "default") continue; // the API refuses it; the zod schema applies the default after the answer arrives
        out[k] = clean(v);
      }
      if (out.type === "object" && out.properties) {
        out.additionalProperties = false;
        out.required = Object.keys(out.properties as object);
      }
      return out;
    }
    return node;
  };
  return clean(raw) as Record<string, unknown>;
}

/** Fields that are nullable in the lesson (empty in the model's plain-string form). */
const NULLABLE_KEYS = new Set(["article", "plural", "tip", "note", "safety_note", "target_hint"]);

/** Turns the model's answer back into the lesson's shape: "" (or "none" for an article) becomes null. Dialogue lines' `en` too. */
export function wireToDomain(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(wireToDomain);
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const isScriptLine = "speaker" in obj && "de" in obj;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const nullable = NULLABLE_KEYS.has(k) || (isScriptLine && k === "en");
      out[k] = nullable && (v === "" || v === "none" || (typeof v === "string" && v.trim() === "")) ? null : wireToDomain(v);
    }
    // An accepted answer that the checker would not tell apart from the answer (or from an earlier accepted answer) is dropped: it changes nothing for the learner.
    if (typeof out.answer === "string" && Array.isArray(out.accepted_answers)) {
      const seen = new Set([normalise(out.answer)]);
      out.accepted_answers = out.accepted_answers.filter((a) => typeof a !== "string" || (!seen.has(normalise(a)) && seen.add(normalise(a))));
    }
    return out;
  }
  return node;
}

export const PASS_A_JSON_SCHEMA = toApiSchema(passASchema, { simplifyNull: true });
export const PASS_B_JSON_SCHEMA = toApiSchema(passBSchema, { simplifyNull: true });
export const PASS_C_JSON_SCHEMA = toApiSchema(passCSchema, { simplifyNull: true });
export const PASS_D_JSON_SCHEMA = toApiSchema(passDSchema, { simplifyNull: true });
export const REVIEW_JSON_SCHEMA = toApiSchema(reviewResultSchema);
