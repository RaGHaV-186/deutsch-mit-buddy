import { cefrOf, type CurriculumRow } from "./curriculum-rows.ts";
import { COUNTS, EXERCISES_PER_LESSON, LEVEL_PROFILES, type Lesson, type PassA } from "./lesson-schema.ts";
import { enumerateItems, valueOf } from "./lesson-items.ts";
import type { LintIssue } from "./lesson-lint.ts";

// Models and settings. Sonnet writes a lesson in two passes (A teaches, B tests the four skills and sees A's output);
// Opus then checks every item (BLUEPRINT section 2). All three are Batch API runs.
export const GENERATION_MODEL = "claude-sonnet-5-5";
export const REVIEW_MODEL = "claude-opus-5-5";
export const PASS_A_MAX_TOKENS = 20_000;
export const PASS_B_MAX_TOKENS = 16_000;
export const REVIEW_MAX_TOKENS = 20_000;
/** Typical output per request (thinking included), used for the "expected" cost; the worst case uses max tokens. */
export const EXPECTED_OUTPUT = { "generate-a": 9_000, "generate-b": 7_000, review: 8_000 } as const;

const SHARED = `You write lesson content for "Deutsch mit Buddy", AI-based personalised German practice for adults who study in English and go from zero to C1. Every lesson follows one fixed standard of 14 parts. You write some of the parts in each request and reply with the JSON object requested and nothing else.

GENERAL RULES
- All German must be correct, natural, modern standard German (Germany), spelled correctly with correct capitals and punctuation. English must be accurate and clear.
- Everything is original. Never copy or closely paraphrase published texts, textbooks, songs or exams. Never claim anything is official, certified or from a language institute.
- Never use real people's names. Use only Anna, Jonas and Lena (and Buddy, the teacher dog, where he speaks). No brands, no politics, no religion, nothing that dates quickly.
- Match the CEFR level and the instruction language given in the request. Never use grammar or vocabulary clearly above the level, and keep words taught in earlier lessons simple. The lesson's grammar point and theme run through every part.
- Instruction language: the text that explains or instructs (goal, grammar explanation, rule summary, tips, exercise explanations, culture note, mission, task descriptions) is written in the instruction language of the request. German examples, words, sentences, dialogues and model answers are always German.
- A question has exactly one correct answer. Wrong options are plausible but clearly wrong. Explanations are one short sentence in the instruction language.
- Question formats: multiple_choice (prompt, answer, 2 to 4 wrong options in distractors); gap_fill (a sentence with ___ where the answer belongs, plus 2 to 4 wrong options); ordering (the words of one sentence in scrambled order separated by " / ", the correct sentence as the answer, no wrong options; only sentences with one natural word order); typing (an English sentence to translate into German, one best German answer, no wrong options); dictation (prompt: a short instruction such as "Listen and write the sentence."; answer: the German sentence that is read aloud, with its punctuation; no wrong options).`;

export const PASS_A_SYSTEM = `${SHARED}

PASS A: parts 0 to 5 of the standard.
- goal: one "can-do" sentence (I can ...) for this lesson.
- warmup: exactly ${COUNTS.warmup} short recall items (gap_fill or multiple_choice) on THIS lesson's grammar point, for use as spaced review in later weeks. They must stand on their own without the lesson text.
- grammar: intro (title; explanation as ${COUNTS.examples[0] - 3} to 4 short paragraphs; rule_summary as one line), exactly ${COUNTS.examples[1]} examples (German sentence, English translation, optional note) that show the rule clearly, and ${COUNTS.traps[0]} to 3 common traps (a typical wrong sentence, the right sentence, and why).
- exercises: exactly ${EXERCISES_PER_LESSON} items: ${Object.entries(COUNTS.exercises).map(([t, n]) => `${n} ${t}`).join(", ")}. They practise the grammar point and the lesson's words. Give each a skill: grammar, vocabulary, articles, word_order, translation or dictation.
- vocabulary: exactly ${COUNTS.wordsCore} core and ${COUNTS.wordsBonus} bonus words (tier "core" / "bonus") for the theme, and exactly ${COUNTS.phrases} useful phrases (Redemittel: complete spoken phrases for real situations, with en = what the learner wants to say, de = the phrase, an example sentence in context with its translation, and an optional tip).
  Word cards: de = the German word only with no article (nouns capitalised); article = der, die or das for nouns, null for everything else; plural = for nouns "die Namen" (write "—" when there is no usual plural), for verbs the present-tense line "ich komme · du kommst · er kommt" (show irregular forms), otherwise null; en = the short English meaning (add a note in brackets when two German words share one English word, e.g. "student (male)"); example = one natural sentence with the word in the form taught, simple enough for the level; example_en = its translation; tip = optional hint of at most 80 characters about gender patterns, spelling or usage, else null. No word twice.
- pronunciation: the sound or pattern of the day (focus, a short explanation, 6 to 8 practice words each with a hint on how to say it, and 3 to 4 practice sentences to read aloud). Choose a focus the lesson's own words and sentences let the learner practise.`;

export const PASS_B_SYSTEM = `${SHARED}

PASS B: parts 6 to 13 of the standard. The request contains pass A (the lesson's grammar, words and exercises): reuse its grammar point and words so the lesson hangs together, but write new sentences.
- reading: a passage (title and German text of the requested length) and exactly ${COUNTS.readingQuestions} questions (skill "reading"; mostly multiple_choice, some typing with a short German answer).
- listening: a dialogue between 2 speakers (from Anna, Jonas, Lena) with ${COUNTS.scriptLines[0]} to ${COUNTS.scriptLines[1]} lines of the requested total length. Each line has speaker, de, and en (an English translation for levels A1 and A2; null at higher levels). Then exactly ${COUNTS.listeningQuestions} questions (skill "listening") that can only be answered by listening.
- writing: the task at the level's kind (what to write, min_words as requested, ${COUNTS.mustInclude[0]} to ${COUNTS.mustInclude[1]} points that must be included, ${COUNTS.usefulPhrases[0]} to ${COUNTS.usefulPhrases[1]} useful phrases, a model_answer in German of at least min_words words, and ${COUNTS.rubric[0]} to ${COUNTS.rubric[1]} rubric criteria for correcting it, which include the lesson's grammar point and vocabulary).
- speaking: exactly ${COUNTS.drill} drill items (prompt = a cue in the instruction language, target = the German sentence to say, tip optional) practising the lesson's sentences, and a tandem scenario in which Buddy is a conversation PARTNER, not a teacher, on the lesson's theme (title, setting, buddy_role, learner_role, opening_line = Buddy's first German line, target_phrases, target_grammar, topics = follow-up questions or ideas Buddy can raise, end_condition).
- culture: a short, accurate, neutral note about life in Germany, Austria or Switzerland tied to the theme (80 to 150 words at low levels), with a reflection question. If unsure of a fact, leave it out. No stereotypes.
- mission: a safe real-world task the learner can do in or around daily life using the lesson (title, task, 2 to 4 steps, report_prompt = what to report back, 2 to 3 success_check lines "I ..."); add a safety_note when the task involves other people or personal data, else null.
- exam: the day exam, with FRESH items, none repeated from pass A: exactly ${COUNTS.examGrammarVocab} grammar_vocab questions on the day's grammar point and words; a short reading passage (2 to 4 sentences) with exactly ${COUNTS.examReadingQuestions} questions; a short listening script (${COUNTS.examScriptLines[0]} to ${COUNTS.examScriptLines[1]} lines) with exactly ${COUNTS.examListeningQuestions} questions; a short writing task (2 to 3 sentences, min_words 15 to 30, with rubric); a short speaking prompt.
- closing: ${COUNTS.closingCovered[0]} to ${COUNTS.closingCovered[1]} "You can now ..." lines for what was covered and one line on what to review tomorrow.`;

export const REVIEW_SYSTEM = `You are a meticulous German teacher and editor. Another model wrote one lesson of "Deutsch mit Buddy", a course for adults who study in English and go from zero to C1, following a fixed 14-part standard. You check every item of the lesson and reply with the JSON object requested and nothing else.

For every item check what applies:
- German: correct, natural, modern standard German; spelling, capitals, punctuation; for cards the article (der/die/das, as in the Duden), the plural or the verb-forms line.
- English: accurate; the English translation matches the German; the English meaning is not misleading.
- Level: words, grammar and text length suit the stated CEFR level and the lesson's grammar point and theme; nothing clearly above the level.
- Instruction language: explanations and instructions are written in the instruction language stated for the level (German examples and words stay German).
- Questions: exactly one answer is right; wrong options are clearly wrong and not also acceptable; for ordering questions the scrambled words are exactly the words of the answer and no other natural word order is also correct; for dictation the answer is a natural sentence that can be read aloud; explanations are true.
- Passages, tasks, scenario, culture note, mission: coherent, useful for learning, original, safe, accurate (a doubtful cultural fact is a problem), neutral; reading and listening questions can only be answered from the text or dialogue; the exam items are fresh and cover the day's grammar and words; the writing rubric covers the lesson's grammar and vocabulary; the Tandem scenario makes Buddy a conversation partner.
- Names: only Anna, Jonas, Lena and Buddy; no real people, brands or politics.

Give every item exactly one verdict, in the order given, using its id:
- "ok": nothing needs changing. Reason of at most 12 words.
- "fixed": you corrected a clear, objective error. Put the whole corrected item, as a JSON object with exactly the same fields as the original, as text in fixed_json; keep it as close to the original as possible, and say in the reason what was wrong and what you changed.
- "needs-human": something is wrong or doubtful and you cannot settle it with confidence (a word clearly above the level, an ambiguous question, a meaning that depends on taste or region, anything you are not sure about). Leave the item unchanged (fixed_json null) and explain the doubt in the reason. Prefer this over guessing.
Do not rewrite items for style or taste; fix only errors. For "ok" and "needs-human", fixed_json is null.`;

const phaseLabel = (phase: CurriculumRow["phase"]) => (phase === "zero" ? "zero phase, before A1" : phase === "exam" ? "B1 exam preparation" : phase);

function lessonSpec(lesson: CurriculumRow): string[] {
  const profile = LEVEL_PROFILES[lesson.phase];
  const lines = [
    `Lesson ${lesson.code} (${phaseLabel(lesson.phase)}; CEFR level ${cefrOf(lesson.phase)})`,
    `Grammar point: ${lesson.grammar}`,
    lesson.theme && lesson.theme !== "—" ? `Theme: ${lesson.theme}` : "Theme: none set. Choose useful B1 vocabulary and situations for the exam tasks named in the grammar point (reading, listening, writing, speaking).",
  ];
  if (lesson.goal) lines.push(`Goal: ${lesson.goal}`);
  lines.push(`Instruction language: ${profile.instructionLanguage}.`);
  if (lesson.phase === "zero") lines.push("This is the zero phase: absolute beginners. Keep every word and sentence very simple (present tense, short sentences).");
  return lines;
}

export function passAPrompt(lesson: CurriculumRow): string {
  return [...lessonSpec(lesson), "", "Write parts 0 to 5 of this lesson."].join("\n");
}

export function passBPrompt(lesson: CurriculumRow, passA: PassA): string {
  const p = LEVEL_PROFILES[lesson.phase];
  const words = passA.vocabulary.words.map((c) => `${c.article ? c.article + " " : ""}${c.de}`).join(", ");
  return [
    ...lessonSpec(lesson),
    `Reading passage length: ${p.readingWords[0]} to ${p.readingWords[1]} words.`,
    `Dialogue length: ${p.listeningWords[0]} to ${p.listeningWords[1]} words in total.`,
    `Writing task: ${p.writingKind}, min_words ${p.writingMinWords[0]} to ${p.writingMinWords[1]}.`,
    "",
    "Pass A of this lesson (use its grammar and words):",
    `Grammar: ${passA.grammar.intro.title}. ${passA.grammar.intro.rule_summary}`,
    `Words: ${words}`,
    `Phrases: ${passA.vocabulary.phrases.map((x) => x.de).join(" | ")}`,
    `Pronunciation focus: ${passA.pronunciation.focus}`,
    "",
    "Write parts 6 to 13 of this lesson.",
  ].join("\n");
}

export function reviewPrompt(lesson: CurriculumRow, content: Lesson, lint: LintIssue[]): string {
  const p = LEVEL_PROFILES[lesson.phase];
  const items = enumerateItems(lesson.code, content).map((i) => ({ id: i.id, unit: i.unit, value: valueOf(content, i) }));
  const hints = lint.length ? lint.map((l) => `- ${l.id}: ${l.message}`).join("\n") : "- none";
  return [
    ...lessonSpec(lesson),
    `Expected: reading ${p.readingWords[0]} to ${p.readingWords[1]} words; dialogue ${p.listeningWords[0]} to ${p.listeningWords[1]} words; writing task ${p.writingKind} with min_words ${p.writingMinWords[0]} to ${p.writingMinWords[1]}.`,
    "",
    "Automatic checks (hints only, they can be wrong):",
    hints,
    "",
    `Items to check (${items.length}), in lesson order:`,
    JSON.stringify(items),
  ].join("\n");
}
