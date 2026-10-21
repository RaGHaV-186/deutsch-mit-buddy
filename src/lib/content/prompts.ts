import { BONUS_WORDS, CORE_WORDS, cefrOf, type CurriculumRow } from "./curriculum-rows.ts";
import { cardId, QUESTION_PLAN, QUESTIONS_PER_LESSON, questionId, type LessonContent } from "./schema.ts";
import type { LintIssue } from "./lint.ts";

// Models and settings. Sonnet writes, Opus checks (BLUEPRINT section 2; the second pass is a separate Batch run).
export const GENERATION_MODEL = "claude-sonnet-5-5";
export const REVIEW_MODEL = "claude-opus-5-5";
export const GENERATION_MAX_TOKENS = 10_000;
export const REVIEW_MAX_TOKENS = 10_000;
/** Typical output (thinking included) per request, used for the "expected" cost; the ceiling uses max tokens. */
export const GENERATION_EXPECTED_OUTPUT = 4_500;
export const REVIEW_EXPECTED_OUTPUT = 4_500;

export const GENERATION_SYSTEM = `You write the vocabulary cards and test questions for "Deutsch mit Buddy", a German course for adult learners who study in English and go from zero to B1. Each request is one lesson. Reply with the JSON object requested and nothing else.

CARDS (exactly ${CORE_WORDS} with tier "core", then exactly ${BONUS_WORDS} with tier "bonus")
- The core words are the lesson's main vocabulary for its theme; the bonus words are closely related and a little less central. Every word must suit the lesson's theme and its CEFR level. Never use a word above that level. No word twice in the lesson.
- de: the German word only, spelled correctly, with no article. Nouns are capitalised.
- article: "der", "die" or "das" for nouns (standard German, as in the Duden); null for everything else (verbs, adjectives, adverbs, phrases, numbers).
- plural: for nouns the article and plural form, for example "die Namen" (write "—" when the noun has no usual plural). For verbs the present-tense line "ich komme · du kommst · er kommt" (show irregular forms where they occur, for example "ich fahre · du fährst · er fährt"). For other words null.
- en: the short English meaning. Add a note in brackets when two German words share one English word, for example "student (male)" and "student (female)".
- example: one natural German sentence that uses the word in the form taught, at the lesson's level, using only simple words the learner can know by then. Never use real people's names; use Anna, Jonas or Lena.
- example_en: a faithful English translation of the example.
- tip: optional short English hint (at most 80 characters) about gender patterns, spelling or usage; null when there is nothing useful.

QUESTIONS (exactly ${QUESTIONS_PER_LESSON}): ${QUESTION_PLAN.map((p) => `${p.count} × skill "${p.skill}" as "${p.type}"`).join("; ")}.
- Use only vocabulary and grammar taught up to and including this lesson. Each question has exactly one correct answer.
- vocabulary / multiple_choice: prompt asks what a German word or phrase means (for example What does “der Kaffee” mean?); answer is the English meaning; 3 wrong options that are plausible but wrong.
- articles / multiple_choice: prompt is the noun with a gap for its article (for example ___ Kaffee); answer is der, die or das; the two wrong options are the other two articles.
- grammar / gap_fill: a German sentence with ___ where the lesson's grammar point decides the missing word or ending; answer is the missing text; 3 wrong options. When the lesson has no real grammar rule (alphabet, sounds, numbers), test the spelling, sound or number pattern taught instead.
- word_order / ordering: prompt lists the words of one German sentence in scrambled order separated by " / "; answer is the correct sentence. Only use sentences with a single natural word order, so the answer is unambiguous. No wrong options.
- translation / typing: prompt is an English sentence; answer is the one best German sentence. No wrong options.
- explanation: one short English sentence on why the answer is right.
- For multiple_choice and gap_fill, "distractors" holds the wrong options only (never the answer); for the other types it is an empty array.`;

export function generationPrompt(lesson: CurriculumRow): string {
  const cefr = cefrOf(lesson.phase);
  const lines = [
    `Lesson ${lesson.code} (${lesson.phase === "zero" ? "zero phase, before A1" : lesson.phase === "exam" ? "B1 exam preparation" : lesson.phase}; CEFR level ${cefr})`,
    `Grammar point: ${lesson.grammar}`,
    lesson.theme && lesson.theme !== "—" ? `Theme: ${lesson.theme}` : "Theme: none set. Choose useful B1 vocabulary for the exam tasks named in the grammar point (reading, listening, writing, speaking).",
  ];
  if (lesson.goal) lines.push(`Goal: ${lesson.goal}`);
  if (lesson.phase === "zero") {
    lines.push("This is the zero phase: absolute beginners. Keep every word and sentence very simple (present tense, short sentences) and keep the tips in plain English.");
  }
  lines.push(`Write ${CORE_WORDS} core and ${BONUS_WORDS} bonus cards and the ${QUESTIONS_PER_LESSON} questions.`);
  return lines.join("\n");
}

export const REVIEW_SYSTEM = `You are a meticulous German teacher and editor. Another model wrote vocabulary cards and test questions for "Deutsch mit Buddy", a German course for adults who study in English and go from zero to B1. You check every item and reply with the JSON object requested and nothing else.

For every CARD check: the article (der/die/das) is right for standard German; the plural or the verb-forms line is right; the example sentence is correct, natural German that really uses the word; the English meaning and the example translation are accurate and not misleading; the word and the sentence suit the lesson's CEFR level and theme; spelling and capitals are right.
For every QUESTION check: exactly one answer is right; the answer is correct German or correct English as asked; every wrong option is clearly wrong (not also acceptable); the question tests what the lesson taught and not more; for ordering questions the scrambled words are exactly the words of the answer and no other natural word order is also correct; the explanation is true and matches the answer.

Give every item exactly one verdict, in the order given, using its id:
- "ok": nothing needs changing. Give a reason of at most 12 words.
- "fixed": you corrected a clear, objective error. Put the whole corrected item in fixed_card (for a card) or fixed_question (for a question), keep it as close to the original as possible, and say in the reason what was wrong and what you changed.
- "needs-human": something is wrong or doubtful and you cannot settle it with confidence (a word clearly above the level, an ambiguous question, a meaning that depends on taste or region, anything you are not sure about). Leave the item unchanged and explain the doubt in the reason. Prefer this over guessing.
Do not rewrite items for style or taste. Fix only errors. For an "ok" or "needs-human" item set both fixed fields to null.`;

export function reviewPrompt(lesson: CurriculumRow, content: LessonContent, lint: LintIssue[]): string {
  const items = [
    ...content.cards.map((c, i) => ({ id: cardId(lesson.code, i), item: "card", ...c })),
    ...content.questions.map((q, i) => ({ id: questionId(lesson.code, i), item: "question", ...q })),
  ];
  const hints = lint.length
    ? lint.map((l) => `- ${l.id}: ${l.message}`).join("\n")
    : "- none";
  return [
    `Lesson ${lesson.code} (${lesson.phase}; CEFR level ${cefrOf(lesson.phase)})`,
    `Grammar point: ${lesson.grammar}`,
    `Theme: ${lesson.theme}`,
    "",
    "Automatic checks (hints only, they can be wrong):",
    hints,
    "",
    "Items to check:",
    JSON.stringify(items, null, 1),
  ].join("\n");
}
