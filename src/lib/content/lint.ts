import { cardId, QUESTION_PLAN, QUESTIONS_PER_LESSON, questionId, type GeneratedCard, type GeneratedQuestion, type LessonContent } from "./schema.ts";
import { BONUS_WORDS, CORE_WORDS } from "./curriculum-rows.ts";

// Free, mechanical checks that run before the paid review: they catch broken structure (a gap question with no gap,
// a scrambled sentence that is missing a word) and flag things the reviewer should look at. They never judge German.

export interface LintIssue {
  /** A card or question id, or "lesson" for problems with the whole lesson. */
  id: string;
  level: "error" | "warn";
  rule: string;
  message: string;
}

const letters = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function lintCard(c: GeneratedCard, id: string): LintIssue[] {
  const out: LintIssue[] = [];
  const add = (level: LintIssue["level"], rule: string, message: string) => out.push({ id, level, rule, message });
  if (/^(der|die|das)\s/i.test(c.de)) add("error", "article-in-de", "The article is part of the German word; it belongs in the article field.");
  if (c.article) {
    if (!/^\p{Lu}/u.test(c.de)) add("error", "noun-capital", "A noun starts with a capital letter.");
    if (!c.plural) add("warn", "plural-missing", "A noun needs a plural line (or a note that it has none).");
    else if (!/^(die\s|[–—-]|no plural|kein plural)/i.test(c.plural)) add("warn", "plural-format", "The plural line should read like “die Kaffees”.");
  }
  if (/^to\s/i.test(c.en) && !c.article && !(c.plural ?? "").toLowerCase().includes("ich ")) {
    add("warn", "verb-forms", "A verb needs a forms line like “ich komme · du kommst · er kommt”.");
  }
  const word = c.de.toLowerCase();
  const stem = word.length > 5 ? word.replace(/(en|er|e|n)$/, "") : word;
  const example = c.example.toLowerCase();
  if (!example.includes(word) && !example.includes(stem) && !(c.plural ?? "").toLowerCase().split(/[\s·,/]+/).some((f) => f.length > 3 && example.includes(f))) {
    add("warn", "example-word", "The example sentence does not seem to contain the word.");
  }
  if (!/[.!?]$/.test(c.example.trim())) add("warn", "example-punctuation", "The example sentence should end with . ! or ?");
  return out;
}

function lintQuestion(q: GeneratedQuestion, id: string): LintIssue[] {
  const out: LintIssue[] = [];
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
    const given = parts.flatMap(letters).sort().join(" ");
    const wanted = letters(q.answer).sort().join(" ");
    if (parts.length < 3 || given !== wanted) add("error", "ordering-words", "The scrambled words must be exactly the words of the answer sentence.");
    if (d.length > 0) add("warn", "ordering-options", "An ordering question has no wrong options.");
  }
  if (q.type === "typing" && d.length > 0) add("warn", "typing-options", "A typing question has no wrong options.");
  if (q.skill === "articles") {
    if (!["der", "die", "das"].includes(q.answer.toLowerCase())) add("error", "article-answer", "An article question is answered with der, die or das.");
    if (q.type === "multiple_choice" && !d.every((x) => ["der", "die", "das"].includes(x.toLowerCase()))) add("error", "article-options", "Wrong options of an article question are the other articles.");
  }
  return out;
}

export function lintLesson(code: string, content: LessonContent): LintIssue[] {
  const issues: LintIssue[] = [];
  const core = content.cards.filter((c) => c.tier === "core").length;
  const bonus = content.cards.filter((c) => c.tier === "bonus").length;
  if (core !== CORE_WORDS || bonus !== BONUS_WORDS) {
    issues.push({ id: "lesson", level: "error", rule: "card-count", message: `Expected ${CORE_WORDS} core + ${BONUS_WORDS} bonus words, got ${core} + ${bonus}.` });
  }
  if (content.questions.length !== QUESTIONS_PER_LESSON) {
    issues.push({ id: "lesson", level: "error", rule: "question-count", message: `Expected ${QUESTIONS_PER_LESSON} questions, got ${content.questions.length}.` });
  }
  for (const plan of QUESTION_PLAN) {
    const n = content.questions.filter((q) => q.skill === plan.skill && q.type === plan.type).length;
    if (n !== plan.count) issues.push({ id: "lesson", level: "warn", rule: "question-mix", message: `Expected ${plan.count} ${plan.skill} (${plan.type}) questions, got ${n}.` });
  }
  const seen = new Map<string, number>();
  content.cards.forEach((c, i) => {
    const key = c.de.toLowerCase();
    if (seen.has(key)) issues.push({ id: cardId(code, i), level: "error", rule: "duplicate-word", message: `“${c.de}” appears twice in this lesson.` });
    seen.set(key, i);
    issues.push(...lintCard(c, cardId(code, i)));
  });
  content.questions.forEach((q, i) => issues.push(...lintQuestion(q, questionId(code, i))));
  return issues;
}

/** Items that cannot be right as they are (the reviewer must fix them or send them to a human). */
export const errorIds = (issues: LintIssue[]) => new Set(issues.filter((i) => i.level === "error").map((i) => i.id));
