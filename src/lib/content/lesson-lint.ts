import { COUNTS, LEVEL_PROFILES, type Card, type Lesson, type Phase, type Question } from "./lesson-schema.ts";
import { enumerateItems, type LessonItem } from "./lesson-items.ts";

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
const tokens = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const wordCount = (s: string) => words(s).length;

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
  if (/^(der|die|das)\s/i.test(c.de)) add("error", "article-in-de", "The article is part of the German word; it belongs in the article field.");
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

function lintQuestion(q: Question, id: string, dictationMax: number, out: LintIssue[]) {
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
  if (q.type === "dictation" && wordCount(q.answer) > dictationMax) add("warn", "dictation-length", `A dictation sentence at this level has at most ${dictationMax} words.`);
  if (q.skill === "articles") {
    if (!["der", "die", "das"].includes(q.answer.toLowerCase())) add("error", "article-answer", "An article question is answered with der, die or das.");
    if (q.type === "multiple_choice" && !d.every((x) => ["der", "die", "das"].includes(x.toLowerCase()))) add("error", "article-options", "Wrong options of an article question are the other articles.");
  }
}

const range = (n: number, [lo, hi]: readonly [number, number]) => n >= lo && n <= hi;
const rangeText = ([lo, hi]: readonly [number, number]) => (lo === hi ? `${lo}` : `${lo} to ${hi}`);

export function lintLesson(code: string, phase: Phase, lesson: Lesson): LintIssue[] {
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
  if (lesson.vocabulary.phrases.length !== COUNTS.phrases) lessonIssue("error", "phrase-count", `Expected ${COUNTS.phrases} useful phrases, got ${lesson.vocabulary.phrases.length}.`);
  if (lesson.warmup.items.length !== COUNTS.warmup) lessonIssue("error", "warmup-count", `Expected ${COUNTS.warmup} warm-up items, got ${lesson.warmup.items.length}.`);
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
  if (wordCount(lesson.writing.model_answer) < lesson.writing.min_words * 0.8) lessonIssue("warn", "model-answer-length", "The model answer is shorter than the task asks for.", id("writing"));

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
  lesson.warmup.items.forEach((q, i) => lintQuestion(q, id("warmup", "items", i), profile.dictationMaxWords, out));
  lesson.exercises.items.forEach((q, i) => lintQuestion(q, id("exercises", "items", i), profile.dictationMaxWords, out));
  lesson.reading.questions.forEach((q, i) => lintQuestion(q, id("reading", "questions", i), profile.dictationMaxWords, out));
  lesson.listening.questions.forEach((q, i) => lintQuestion(q, id("listening", "questions", i), profile.dictationMaxWords, out));
  lesson.exam.grammar_vocab.forEach((q, i) => lintQuestion(q, id("exam", "grammar_vocab", i), profile.dictationMaxWords, out));
  lesson.exam.reading.questions.forEach((q, i) => lintQuestion(q, id("exam", "reading", "questions", i), profile.dictationMaxWords, out));
  lesson.exam.listening.questions.forEach((q, i) => lintQuestion(q, id("exam", "listening", "questions", i), profile.dictationMaxWords, out));
  lesson.grammar.traps.forEach((t, i) => {
    if (same(t.wrong, t.right)) out.push({ id: id("grammar", "traps", i), level: "error", rule: "trap-same", message: "The wrong and the right version are the same." });
  });
  return out;
}

export const errorIds = (issues: LintIssue[]) => new Set(issues.filter((i) => i.level === "error").map((i) => i.id));
export const lessonErrors = (issues: LintIssue[]) => issues.filter((i) => i.level === "error" && i.id === "lesson");
export type { LessonItem };
