import { normalise } from "./answer-check.ts";
import { COMMON_TRAPS } from "./common-traps.ts";
import { COUNTS, LEVEL_PROFILES, WRITTEN_TYPES, type Card, type Lesson, type Phase, type Question } from "./lesson-schema.ts";
import { enumerateItems, valueOf, type LessonItem } from "./lesson-items.ts";
import { foreignSurnames, SURNAMES } from "./names.ts";

// Free, mechanical checks that run before the paid review and again after every correction. They catch broken structure
// (a gap question with no gap, a scrambled sentence missing a word, a lesson with 4 exercises instead of 19) and flag what the
// reviewer should look at. They never judge German. An "error" blocks publishing; a "warn" is a hint for the reviewer.

export interface LintIssue {
  /** An item id such as "Z1#exercises.07", or "lesson" for a problem with the lesson as a whole. */
  id: string;
  level: "error" | "warn";
  rule: string;
  message: string;
}

const words = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
const ARTICLE_WORDS = new Set(["der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer", "eines", "kein", "keine", "keinen", "keinem", "keiner", "keines", "vom", "zum", "zur", "im", "am", "ans", "ins", "beim"]);
const tokens = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const wordCount = (s: string) => words(s).length;

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10 };
const NUMBER = `\\d+|${Object.keys(NUMBER_WORDS).join("|")}`;
const SENTENCES_ASKED = new RegExp(`(at least|mindestens)?\\s*\\b(${NUMBER})(?:\\s*(?:to|or|bis|oder|-|–)\\s*(${NUMBER}))?\\s+(?:[\\p{L}-]+\\s+){0,2}?(?:sentences|Sätze)\\b`, "iu");
const asNumber = (n: string) => NUMBER_WORDS[n.toLowerCase()] ?? Number(n);

/** How many sentences a writing task asks for, as [min, max] ("5 short sentences", "3 to 5 sentences", "at least 4 Sätze"), or null when it names no number. */
export function sentencesAsked(task: string): [number, number] | null {
  const m = SENTENCES_ASKED.exec(task);
  if (!m) return null;
  const lo = asNumber(m[2]);
  return [lo, m[1] ? Infinity : m[3] ? asNumber(m[3]) : lo];
}

/** A salutation on its own: "Hallo Jonas!", "Liebe Lena,", "Guten Tag". It does not count as a sentence. ("Liebe Lena, ich ..." is one sentence: the salutation belongs to it.) */
const SALUTATION = /^(?:hallo|hi|liebe[rs]?|guten\s+(?:morgen|tag|abend))(?:\s+\p{Lu}[\p{L}-]+)?\s*,?$/iu;
/** A closing formula, with the signature: "Viele Grüße, Anna", "Liebe Grüße, Lena", "Bis bald, Jonas", "Dein Jonas". It does not count as a sentence. */
const CLOSING = /^(?:(?:viele|liebe|herzliche|beste|freundliche)\s+gr(?:ü|ue)ße|bis\s+(?:bald|später|morgen|dann))(?:\s*,?\s*\p{Lu}[\p{L}-]+){0,2}\s*,?$|^(?:dein|deine)\s+\p{Lu}[\p{L}-]+$/iu;
/** True for a piece of text that is only a salutation or a closing formula (message framing, not a sentence). */
export const isMessageFrame = (piece: string) => {
  const text = piece.trim().replace(/[.!?…]+$/, "");
  return SALUTATION.test(text) || CLOSING.test(text);
};

/**
 * Sentences in a text: the pieces between . ! ? … (a spelled name "A, N, N, A." or a dash dialogue still counts by its full stops).
 * A salutation on its own and a closing formula with its signature do not count: they frame a message, they are not sentences of it.
 */
export const sentenceCount = (text: string) => text.split(/[.!?…]+(?:\s+|$)/).filter((s) => /\p{L}/u.test(s) && !isMessageFrame(s)).length;

const DE = new Set("der die das und ist nicht ich du wir sie er es ein eine einen einem mit für auf zu von den dem im auch aber wie wo wer ja nein bitte danke sind haben hat bin bist wird werden kann können muss dass wenn oder nach bei aus über unter sich mein dein".split(" "));
const EN = new Set("the and is not you we they he it a an with for on to of at also but how what where who yes no please thank are have has be this that your my his her can must will would should or if when from about into your our their".split(" "));

/** Share of German among the German and English function words of a text, or null when there are too few to tell. */
export function germanShare(text: string): number | null {
  let de = 0;
  let en = 0;
  for (const t of tokens(text)) {
    if (DE.has(t)) de += 1;
    else if (EN.has(t)) en += 1;
  }
  return de + en < 8 ? null : de / (de + en);
}

function lintCard(c: Card, id: string, out: LintIssue[]) {
  const add = (level: LintIssue["level"], rule: string, message: string) => out.push({ id, level, rule, message });
  if (/^(der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines)\s/i.test(c.de)) add("error", "article-in-de", "The article is part of the German word; it belongs in the article field.");
  if (c.article) {
    if (!/^\p{Lu}/u.test(c.de)) add("error", "noun-capital", "A noun starts with a capital letter.");
    if (!c.plural) add("warn", "plural-missing", "A noun needs a plural line (or a note that it has none).");
    else if (!/^(die\s|[–—-]|no plural|kein plural)/i.test(c.plural)) add("warn", "plural-format", "The plural line should read like “die Kaffees”.");
  }
  if (/^to\s/i.test(c.en) && !c.article && !(c.plural ?? "").toLowerCase().includes("ich ")) add("warn", "verb-forms", "A verb needs a forms line like “ich komme · du kommst · er kommt”.");
  const word = c.de.toLowerCase();
  const stem = word.length > 5 ? word.replace(/(en|er|e|n)$/, "") : word;
  const example = c.example.toLowerCase();
  if (!example.includes(word) && !example.includes(stem) && !(c.plural ?? "").toLowerCase().split(/[\s·,/]+/).some((f) => f.length > 3 && example.includes(f))) {
    add("warn", "example-word", "The example sentence does not seem to contain the word.");
  }
  if (!/[.!?]$/.test(c.example.trim())) add("warn", "example-punctuation", "The example sentence should end with . ! or ?");
}

function lintQuestion(q: Question, id: string, dictationMax: number, out: LintIssue[], articleForms: ReadonlySet<string>) {
  const add = (level: LintIssue["level"], rule: string, message: string) => out.push({ id, level, rule, message });
  const d = q.distractors;
  if (new Set(d.map((x) => x.toLowerCase())).size !== d.length) add("error", "distractors-distinct", "Wrong options must all differ.");
  if (d.some((x) => same(x, q.answer))) add("error", "distractor-is-answer", "A wrong option equals the right answer.");
  if (q.type === "multiple_choice" && (d.length < 2 || d.length > 4)) add("error", "mc-options", "Multiple choice needs 2 to 4 wrong options.");
  if (q.type === "gap_fill") {
    if (!q.prompt.includes("___")) add("error", "gap-missing", "A gap-fill prompt must contain ___ .");
    if (d.length < 2) add("error", "gap-options", "A gap fill needs at least 2 wrong options.");
  }
  if (q.type === "ordering") {
    const parts = q.prompt.split("/").map((p) => p.trim()).filter(Boolean);
    const given = parts.flatMap(tokens).sort().join(" ");
    const wanted = tokens(q.answer).sort().join(" ");
    if (parts.length < 3 || given !== wanted) add("error", "ordering-words", "The scrambled words must be exactly the words of the answer sentence.");
    if (d.length > 0) add("warn", "ordering-options", "An ordering question has no wrong options.");
  }
  if ((q.type === "typing" || q.type === "dictation") && d.length > 0) add("warn", "no-options", "A typing or dictation question has no wrong options.");
  const accepted = q.accepted_answers;
  if (accepted.length) {
    if (!(WRITTEN_TYPES as readonly string[]).includes(q.type)) add("error", "accepted-type", "Only typing, ordering and dictation questions have accepted answers; a choice question has exactly one right option.");
    const keys = [q.answer, ...accepted].map(normalise);
    if (new Set(keys).size !== keys.length) add("error", "accepted-distinct", "An accepted answer repeats the answer or another accepted answer (case, punctuation and ß/ss are ignored when answers are checked).");
    if (q.type === "dictation" && accepted.some((a) => /\d/.test(a) && !/\d/.test(q.answer))) add("warn", "dictation-digits", "A dictation tests spelling: do not accept digits for number words.");
    if (q.type === "ordering") {
      const wanted = tokens(q.answer).sort().join(" ");
      if (accepted.some((a) => tokens(a).sort().join(" ") !== wanted)) add("error", "accepted-ordering-words", "Every accepted order must use exactly the words of the answer sentence.");
    }
  }
  if (q.type === "dictation" && wordCount(q.answer) > dictationMax) add("warn", "dictation-length", `A dictation sentence at this level has at most ${dictationMax} words.`);
  if (q.skill === "articles") {
    // der/die/das always; any other article form (den, dem, ein, keiner, vom ...) only where the lesson's own grammar teaches it (articleForms).
    const hasArticle = (t: string) => tokens(t).some((w) => articleForms.has(w));
    if (!hasArticle(q.answer) || (q.type === "gap_fill" && tokens(q.answer).length !== 1)) add("error", "article-answer", "An article question is answered with an article form the lesson's grammar teaches (der, die, das, and the other forms of this lesson's grammar point).");
    if (q.type === "multiple_choice" && !d.every((x) => tokens(x).some((w) => ARTICLE_WORDS.has(w)))) add("error", "article-options", "Wrong options of an article question are other article forms (wrong forms of the same paradigm are fine).");
  }
}

const range = (n: number, [lo, hi]: readonly [number, number]) => n >= lo && n <= hi;
const rangeText = ([lo, hi]: readonly [number, number]) => (lo === hi ? `${lo}` : `${lo} to ${hi}`);

/** What makes a question "the same" as another one: the finished sentence (gap filled in), or the answer, or the English prompt of a translation. */
/** Typing questions in reading and listening must ask for a narrow answer. A prompt that asks for a sentence or a list, or an answer of more than 5 words, is an open question: it belongs in multiple choice. */
const OPEN_PROMPT = /\b(?:in (?:a|one)(?: short| full)? sentence|(?:a|one|full|short) sentence|ganzen? Satz|in einem Satz|(?:two|three|zwei|drei) (?:things|Dinge)|list|describe|explain|beschreib\w*|erkl\w+)\b|write them/i;
function lintOpenTyping(q: Question, id: string, out: LintIssue[]) {
  if (q.type !== "typing") return;
  if (OPEN_PROMPT.test(q.prompt) || wordCount(q.answer) > 5) {
    out.push({ id, level: "warn", rule: "typing-open", message: "A typing question in reading or listening must ask for a narrow answer (one word, a number, a time, one fixed phrase from the text). An open question that wants a sentence or a list belongs in multiple choice." });
  }
}

function questionKeys(q: Question): string[] {
  const keys: string[] = [];
  if (q.type === "gap_fill") keys.push(normalise(q.prompt.replace("___", q.answer)));
  else if (q.type === "ordering" || q.type === "dictation") keys.push(normalise(q.answer));
  else if (q.type === "typing") keys.push(normalise(q.answer), normalise(q.prompt));
  else keys.push(normalise(`${q.prompt} ${q.answer}`));
  return keys.filter((k) => k.split(" ").length >= 3 || q.type === "multiple_choice");
}

/** The sentences of a text, normalised. Formulaic short ones ("Das ist Jonas.", "Wie heißt du?") are not counted: at A1 a lesson and its exam cannot help sharing them. */
const MIN_SHARED_SENTENCE_WORDS = 5;
function sentenceKeys(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n/).map(normalise).filter((k) => k.split(" ").length >= MIN_SHARED_SENTENCE_WORDS);
}

export interface LintOptions {
  /** True for the very first lesson of the course: nothing to review yet, so the warm-up is a preview. */
  first?: boolean;
}

export function lintLesson(code: string, phase: Phase, lesson: Lesson, options: LintOptions = {}): LintIssue[] {
  const profile = LEVEL_PROFILES[phase];
  const out: LintIssue[] = [];
  const items = enumerateItems(code, lesson);
  const idAt = new Map(items.map((i) => [JSON.stringify(i.pointer), i.id]));
  const id = (...pointer: (string | number)[]) => idAt.get(JSON.stringify(pointer)) ?? "lesson";
  const lessonIssue = (level: LintIssue["level"], rule: string, message: string, target = "lesson") => out.push({ id: target, level, rule, message });

  // ---- counts (errors: a lesson with the wrong shape cannot publish)
  const w = lesson.vocabulary.words;
  if (!range(w.length, COUNTS.wordsTotal)) lessonIssue("error", "word-count", `Expected ${rangeText(COUNTS.wordsTotal)} words, got ${w.length}.`);
  if (w.filter((c) => c.tier === "core").length < 10 || w.filter((c) => c.tier === "bonus").length < 4) lessonIssue("warn", "word-tiers", `Expected about ${COUNTS.wordsCore} core and ${COUNTS.wordsBonus} bonus words.`);
  if (!range(lesson.vocabulary.phrases.length, [COUNTS.phrases, COUNTS.phrasesMax])) lessonIssue("error", "phrase-count", `Expected ${COUNTS.phrases} useful phrases (up to ${COUNTS.phrasesMax} when a lesson note asks for more), got ${lesson.vocabulary.phrases.length}.`);
  const preview = lesson.warmup.preview.points.length;
  if (options.first) {
    if (!range(preview, COUNTS.warmupPreview)) lessonIssue("error", "warmup-preview", `The first lesson has nothing to review: its warm-up is a preview of ${rangeText(COUNTS.warmupPreview)} points “Today you'll learn ...”, got ${preview}.`);
    if (lesson.warmup.items.length) lessonIssue("error", "warmup-count", "The first lesson has no warm-up questions (there is nothing earlier to review).");
  } else {
    if (lesson.warmup.items.length !== COUNTS.warmup) lessonIssue("error", "warmup-count", `Expected ${COUNTS.warmup} warm-up items, got ${lesson.warmup.items.length}.`);
    if (preview) lessonIssue("error", "warmup-preview", "Only the first lesson has a preview; every other warm-up reviews earlier sessions.");
  }
  if (lesson.grammar.tables.length > COUNTS.tables[1]) lessonIssue("error", "table-count", `At most ${COUNTS.tables[1]} support tables, got ${lesson.grammar.tables.length}.`);
  lesson.grammar.tables.forEach((t, i) => {
    if (t.rows.some((r) => r.length !== t.headers.length)) out.push({ id: id("grammar", "tables", i), level: "error", rule: "table-shape", message: "Every table row needs one cell per column header." });
  });
  if (!range(lesson.grammar.examples.length, COUNTS.examples)) lessonIssue("error", "example-count", `Expected ${rangeText(COUNTS.examples)} grammar examples, got ${lesson.grammar.examples.length}.`);
  if (!range(lesson.grammar.traps.length, COUNTS.traps)) lessonIssue("error", "trap-count", `Expected ${rangeText(COUNTS.traps)} common traps, got ${lesson.grammar.traps.length}.`);
  for (const [type, n] of Object.entries(COUNTS.exercises)) {
    const have = lesson.exercises.items.filter((q) => q.type === type).length;
    if (have !== n) lessonIssue("error", "exercise-mix", `Expected ${n} ${type} exercises, got ${have}.`);
  }
  if (lesson.exercises.items.length !== Object.values(COUNTS.exercises).reduce((a, b) => a + b, 0)) lessonIssue("error", "exercise-count", `Expected 19 exercises in total, got ${lesson.exercises.items.length}.`);
  if (!range(lesson.pronunciation.words.length, COUNTS.pronunciationWords)) lessonIssue("error", "pron-words", `Expected ${rangeText(COUNTS.pronunciationWords)} pronunciation words.`);
  if (!range(lesson.pronunciation.sentences.length, COUNTS.pronunciationSentences)) lessonIssue("error", "pron-sentences", `Expected ${rangeText(COUNTS.pronunciationSentences)} pronunciation sentences.`);
  if (lesson.reading.questions.length !== COUNTS.readingQuestions) lessonIssue("error", "reading-count", `Expected ${COUNTS.readingQuestions} reading questions.`);
  if (lesson.listening.questions.length !== COUNTS.listeningQuestions) lessonIssue("error", "listening-count", `Expected ${COUNTS.listeningQuestions} listening questions.`);
  if (!range(lesson.listening.passage.script.length, COUNTS.scriptLines)) lessonIssue("error", "script-lines", `The dialogue needs ${rangeText(COUNTS.scriptLines)} lines.`);
  if (lesson.speaking.drill.length !== COUNTS.drill) lessonIssue("error", "drill-count", `Expected ${COUNTS.drill} speaking drill items.`);
  if (!range(lesson.writing.must_include.length, COUNTS.mustInclude)) lessonIssue("warn", "writing-points", `The writing task needs ${rangeText(COUNTS.mustInclude)} points to include.`);
  if (!range(lesson.writing.rubric.length, COUNTS.rubric)) lessonIssue("warn", "writing-rubric", `The writing rubric needs ${rangeText(COUNTS.rubric)} criteria.`);
  if (lesson.exam.grammar_vocab.length !== COUNTS.examGrammarVocab) lessonIssue("error", "exam-gv-count", `The day exam needs ${COUNTS.examGrammarVocab} grammar/vocabulary items.`);
  if (lesson.exam.reading.questions.length !== COUNTS.examReadingQuestions) lessonIssue("error", "exam-reading-count", `The day exam needs ${COUNTS.examReadingQuestions} reading questions.`);
  if (lesson.exam.listening.questions.length !== COUNTS.examListeningQuestions) lessonIssue("error", "exam-listening-count", `The day exam needs ${COUNTS.examListeningQuestions} listening questions.`);
  if (!range(lesson.closing.covered.length, COUNTS.closingCovered)) lessonIssue("warn", "closing-count", `Close day needs ${rangeText(COUNTS.closingCovered)} “you can now” lines.`);

  // ---- level bands (warnings for the reviewer)
  const readingWords = wordCount(lesson.reading.passage.text);
  if (!range(readingWords, profile.readingWords)) lessonIssue("warn", "reading-length", `The reading text has ${readingWords} words; at ${profile.cefr} it should have ${rangeText(profile.readingWords)}.`, id("reading", "passage"));
  const listeningWords = lesson.listening.passage.script.reduce((n, l) => n + wordCount(l.de), 0);
  if (!range(listeningWords, profile.listeningWords)) lessonIssue("warn", "listening-length", `The dialogue has ${listeningWords} words; at ${profile.cefr} it should have ${rangeText(profile.listeningWords)}.`, id("listening", "passage"));
  if (!range(lesson.writing.min_words, profile.writingMinWords)) lessonIssue("warn", "writing-length", `The writing task asks for ${lesson.writing.min_words} words; at ${profile.cefr} it should ask for ${rangeText(profile.writingMinWords)} (${profile.writingKind}).`, id("writing"));
  // The model answer is what a learner is shown as the example: it must meet its own task, in every lesson.
  const answerWords = wordCount(lesson.writing.model_answer);
  if (answerWords < lesson.writing.min_words) lessonIssue("error", "model-answer-length", `The model answer has ${answerWords} words; its own task asks for at least ${lesson.writing.min_words}.`, id("writing"));
  const asked = sentencesAsked(lesson.writing.task);
  const answerSentences = sentenceCount(lesson.writing.model_answer);
  if (asked && (answerSentences < asked[0] || answerSentences > asked[1])) {
    const wanted = asked[1] === Infinity ? `at least ${asked[0]}` : asked[0] === asked[1] ? `${asked[0]}` : `${asked[0]} to ${asked[1]}`;
    lessonIssue("error", "model-answer-sentences", `The model answer has ${answerSentences} sentences; its own task asks for ${wanted}.`, id("writing"));
  }

  // ---- instruction language grows more German with the level
  const instruction: [string, string][] = [
    [id("goal"), lesson.goal.can_do],
    [id("grammar", "intro"), lesson.grammar.intro.explanation.join(" ") + " " + lesson.grammar.intro.rule_summary],
    [id("pronunciation"), lesson.pronunciation.explanation],
    [id("culture"), lesson.culture.note],
    [id("mission"), lesson.mission.task],
    [id("writing"), lesson.writing.task],
  ];
  for (const [target, text] of instruction) {
    const share = germanShare(text);
    if (share === null) continue;
    if (share < profile.germanShare[0] || share > profile.germanShare[1]) {
      lessonIssue("warn", "instruction-language", `Instruction language looks ${Math.round(share * 100)}% German; at ${profile.cefr} it should be ${profile.instructionLanguage}.`, target);
    }
  }

  // ---- the lesson hangs together: the texts use the lesson's words
  const lessonWords = w.map((c) => c.de.toLowerCase());
  const uses = (text: string) => lessonWords.filter((x) => text.toLowerCase().includes(x.replace(/(en|n)$/, ""))).length;
  if (uses(lesson.reading.passage.text) < 2) lessonIssue("warn", "reading-vocabulary", "The reading text uses fewer than 2 of the lesson's words.", id("reading", "passage"));
  if (uses(lesson.listening.passage.script.map((l) => l.de).join(" ")) < 2) lessonIssue("warn", "listening-vocabulary", "The dialogue uses fewer than 2 of the lesson's words.", id("listening", "passage"));

  // ---- items
  const seen = new Map<string, number>();
  w.forEach((c, i) => {
    const key = c.de.toLowerCase();
    if (seen.has(key)) out.push({ id: id("vocabulary", "words", i), level: "error", rule: "duplicate-word", message: `“${c.de}” appears twice in this lesson.` });
    seen.set(key, i);
    lintCard(c, id("vocabulary", "words", i), out);
  });
  // Article forms a question may use: der/die/das, plus the forms this lesson's grammar section shows. A warm-up recalls EARLIER grammar, so any form is fine there.
  const grammarWords = new Set(tokens(JSON.stringify(lesson.grammar)));
  const lessonForms = new Set(["der", "die", "das", ...[...ARTICLE_WORDS].filter((w) => grammarWords.has(w))]);
  lesson.warmup.items.forEach((q, i) => lintQuestion(q, id("warmup", "items", i), profile.dictationMaxWords, out, ARTICLE_WORDS));
  lesson.exercises.items.forEach((q, i) => lintQuestion(q, id("exercises", "items", i), profile.dictationMaxWords, out, lessonForms));
  lesson.reading.questions.forEach((q, i) => lintQuestion(q, id("reading", "questions", i), profile.dictationMaxWords, out, lessonForms));
  lesson.listening.questions.forEach((q, i) => lintQuestion(q, id("listening", "questions", i), profile.dictationMaxWords, out, lessonForms));
  lesson.exam.grammar_vocab.forEach((q, i) => lintQuestion(q, id("exam", "grammar_vocab", i), profile.dictationMaxWords, out, lessonForms));
  lesson.exam.reading.questions.forEach((q, i) => lintQuestion(q, id("exam", "reading", "questions", i), profile.dictationMaxWords, out, lessonForms));
  lesson.exam.listening.questions.forEach((q, i) => lintQuestion(q, id("exam", "listening", "questions", i), profile.dictationMaxWords, out, lessonForms));
  // Open "answer in a sentence" typing questions: warnings for the reviewer (the reading and listening parts, the day exam included).
  lesson.reading.questions.forEach((q, i) => lintOpenTyping(q, id("reading", "questions", i), out));
  lesson.listening.questions.forEach((q, i) => lintOpenTyping(q, id("listening", "questions", i), out));
  lesson.exam.reading.questions.forEach((q, i) => lintOpenTyping(q, id("exam", "reading", "questions", i), out));
  lesson.exam.listening.questions.forEach((q, i) => lintOpenTyping(q, id("exam", "listening", "questions", i), out));
  // ---- the day exam is fresh: nothing in it repeats the warm-up, the exercises or the reading and listening texts
  const lessonQuestions = [...lesson.warmup.items, ...lesson.exercises.items, ...lesson.reading.questions, ...lesson.listening.questions];
  const seenKeys = new Set(lessonQuestions.flatMap(questionKeys));
  const examQuestions: [Question, (string | number)[]][] = [
    ...lesson.exam.grammar_vocab.map((q, i) => [q, ["exam", "grammar_vocab", i]] as [Question, (string | number)[]]),
    ...lesson.exam.reading.questions.map((q, i) => [q, ["exam", "reading", "questions", i]] as [Question, (string | number)[]]),
    ...lesson.exam.listening.questions.map((q, i) => [q, ["exam", "listening", "questions", i]] as [Question, (string | number)[]]),
  ];
  for (const [q, pointer] of examQuestions) {
    if (questionKeys(q).some((k) => seenKeys.has(k))) out.push({ id: id(...pointer), level: "error", rule: "exam-fresh", message: "This exam item repeats a warm-up, exercise or reading/listening question of the lesson. Exam items must be new." });
  }
  const lessonSentences = new Set([
    ...sentenceKeys(lesson.reading.passage.text),
    ...lesson.listening.passage.script.flatMap((l) => sentenceKeys(l.de)),
    ...lesson.grammar.examples.map((e) => normalise(e.de)),
  ]);
  if (sentenceKeys(lesson.exam.reading.passage.text).some((k) => lessonSentences.has(k))) out.push({ id: id("exam", "reading", "passage"), level: "error", rule: "exam-fresh", message: "The exam reading text repeats a sentence from the lesson. Exam texts must be new." });
  if (lesson.exam.listening.passage.script.flatMap((l) => sentenceKeys(l.de)).some((k) => lessonSentences.has(k))) out.push({ id: id("exam", "listening", "passage"), level: "error", rule: "exam-fresh", message: "The exam dialogue repeats a sentence from the lesson. Exam texts must be new." });

  // ---- common traps (hints for the reviewer: the same text is fine inside a trap that explains why it is wrong)
  for (const item of items) {
    if (item.unit === "trap") continue;
    const text = JSON.stringify(valueOf(lesson, item));
    for (const trap of COMMON_TRAPS) if (trap.detect?.test(text)) out.push({ id: item.id, level: "warn", rule: `trap-${trap.id}`, message: `Contains a known trap (${trap.wrong}). Right: ${trap.right}` });
  }
  // ---- names: a surname after Herr/Frau/Mr/Mrs must be one of the fixed generic surnames
  for (const item of items) {
    const odd = foreignSurnames(JSON.stringify(valueOf(lesson, item)));
    if (odd.length) out.push({ id: item.id, level: "error", rule: "surname", message: `Surname ${odd.join(", ")} is not allowed: formal address uses only ${SURNAMES.join(", ")}.` });
  }
  lesson.grammar.traps.forEach((t, i) => {
    if (same(t.wrong, t.right)) out.push({ id: id("grammar", "traps", i), level: "error", rule: "trap-same", message: "The wrong and the right version are the same." });
  });
  return out;
}

export const errorIds = (issues: LintIssue[]) => new Set(issues.filter((i) => i.level === "error").map((i) => i.id));
export const lessonErrors = (issues: LintIssue[]) => issues.filter((i) => i.level === "error" && i.id === "lesson");
export type { LessonItem };
