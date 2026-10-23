import { trapsForPrompt } from "./common-traps.ts";
import { cefrOf, type CurriculumRow } from "./curriculum-rows.ts";
import { COUNTS, EXERCISES_PER_LESSON, LEVEL_PROFILES, type Lesson, type PassA } from "./lesson-schema.ts";
import { enumerateItems, valueOf } from "./lesson-items.ts";
import type { LintIssue } from "./lesson-lint.ts";
import { notesFor, type NotePass } from "./lesson-notes.ts";
import { NAMES_RULE } from "./names.ts";

// Models and settings. Sonnet writes a lesson in four passes (A teaches; B covers reading, listening, writing and speaking; C is the day exam; D covers the
// warm-up, the culture note, the mission and close day; B, C and D see A's output, D also sees the earlier sessions);
// Opus then checks every item (BLUEPRINT section 2). All three are Batch API runs.
export const GENERATION_MODEL = "claude-sonnet-5-5";
export const REVIEW_MODEL = "claude-opus-5-5";
export const PASS_A_MAX_TOKENS = 20_000;
export const PASS_B_MAX_TOKENS = 12_000;
export const PASS_C_MAX_TOKENS = 8_000;
export const PASS_D_MAX_TOKENS = 8_000;
export const REVIEW_MAX_TOKENS = 20_000;
/** The re-review of a few corrected items needs far less room. */
export const REVIEW_PARTIAL_MAX_TOKENS = 8_000;
/** Expected output of a partial review: a base for the thinking plus a little per item. */
export const partialReviewExpectedOutput = (items: number) => 1_500 + 500 * items;
/** Typical output per request (thinking included), used for the "expected" cost; the worst case uses max tokens. */
export const EXPECTED_OUTPUT = { "generate-a": 10_000, "generate-b": 5_000, "generate-c": 3_500, "generate-d": 3_000, review: 9_000 } as const;

const SHARED = `You write lesson content for "Deutsch mit Buddy", AI-based personalised German practice for adults who study in English and go from zero to C1. Every lesson follows one fixed standard of 14 parts. You write some of the parts in each request and reply with the JSON object requested and nothing else.

GENERAL RULES
- All German must be correct, natural, modern standard German (Germany), spelled correctly with correct capitals and punctuation. English must be accurate and clear.
- Everything is original. Never copy or closely paraphrase published texts, textbooks, songs or exams. Never claim anything is official, certified or from a language institute.
- Names: ${NAMES_RULE} No religion, nothing that dates quickly.
- Match the CEFR level and the instruction language given in the request. Never use grammar or vocabulary clearly above the level, and keep words taught in earlier lessons simple. The lesson's grammar point and theme run through every part.
- Instruction language: the text that explains or instructs (goal, grammar explanation, rule summary, tips, exercise explanations, culture note, mission, task descriptions) is written in the instruction language of the request. German examples, words, sentences, dialogues and model answers are always German.
- Output format: where a field has nothing to say, write an empty string (for an article, write none). This applies to article, plural, tip, note, safety_note, target_hint and the en line of a dialogue.
- A question has one best answer. Wrong options are clearly false but plausible: real words or phrases of the same kind as the right answer (a country for a country, a time for a time) that a learner who did not understand could pick. Never nonsense or a joke, and never a second correct answer. Explanations are one short sentence in the instruction language.
- accepted_answers: for typing (translation), ordering and dictation questions, list in accepted_answers every OTHER natural, correct answer a learner could give, for example "Mein Name ist Jonas." next to "Ich heiße Jonas." for the English "My name is Jonas.", or "Aus Deutschland kommt Jonas." next to "Jonas kommt aus Deutschland." for an ordering question. Answers are checked ignoring case, punctuation and ß/ss, so never list spelling variants. For an ordering question every accepted answer uses exactly the words of the question. Use an empty list for multiple_choice and gap_fill questions, and when there is really only one answer. For a dictation never accept digits for number words (a dictation tests spelling). Prefer prompts that leave little room: "Hello!" can be Hallo or Guten Tag, so say "Greet a friend: Hello!" when you want Hallo.
- Typing questions ask for a NARROW answer only: one word, a number, a time, one fixed phrase copied from the text or dialogue ("Um zehn Uhr.", "Schalter 3"), or the translation of a short fixed English sentence. A reading or listening question that would be answered by a sentence of the learner's own ("Was macht Anna mittags? Answer in one short sentence", "Write two things") is too open: write it as multiple_choice (one right answer, three options that are clearly wrong according to the text, ideally taken from the text at another time, place or person, so exactly one answer is defensible; an empty accepted_answers), never as typing. accepted_answers holds at most 8 answers: a question that seems to need more is too open, so make it multiple choice or narrower. Never answer "write a sentence" with a longer list of accepted answers. This is about typing QUESTIONS only: the writing task, the speaking drill and the Tandem scenario are open by design, and ordering (sentence-building) and dictation questions are other types with their own rules.
- Pronunciation claims (a hint or tip about how a letter, a letter group or a word sounds): before you write one, spell the word letter by letter and check that the letters you name are really in it (Tschüs = t + sch + ü + s, so it has tsch, which sounds like English "ch", and not plain sch).
- Question formats: multiple_choice (prompt, answer, 2 to 4 wrong options in distractors); gap_fill (a sentence with ___ where the answer belongs, plus 2 to 4 wrong options); ordering (the prompt is ONLY the words of one sentence in scrambled order separated by " / ", with no instruction text and no colon in it, the correct sentence as the answer, no wrong options); typing (an English sentence to translate into German, one best German answer, no wrong options); dictation (prompt: a short instruction such as "Listen and write the sentence."; answer: the German sentence that is read aloud, with its punctuation; no wrong options).

COMMON TRAPS (known mistakes of learners and of language models). Never teach any of these as correct, anywhere (examples, exercises, model answers, rubrics, missions, exam items). Use the ones that fit the lesson's topic as its "common traps".
${trapsForPrompt()}`;

export const PASS_A_SYSTEM = `${SHARED}

PASS A: the teaching parts of the standard (goal, grammar, exercises, vocabulary, pronunciation). The warm-up comes later, in another request.
- goal: one "can-do" sentence (I can ...) for this lesson.
- grammar: intro (title; explanation as ${COUNTS.examples[0] - 3} to 4 short paragraphs; rule_summary as one line), exactly ${COUNTS.examples[1]} examples (German sentence, English translation, optional note) that show the rule clearly, ${COUNTS.traps[0]} to 3 common traps (a typical wrong sentence, the right sentence, and why), and tables: ${COUNTS.tables[0]} to ${COUNTS.tables[1]} support tables. Use a table whenever the grammar point has a list or a paradigm the learner needs to see at a glance (the alphabet with the letter names, verb endings per person, the articles, a number list, a chart of endings). A table has a title, column headers, and rows with one cell per header; no table is fine when the point has no such list. Do not repeat the table's content in the paragraphs.
- exercises: exactly ${EXERCISES_PER_LESSON} items: ${Object.entries(COUNTS.exercises).map(([t, n]) => `${n} ${t}`).join(", ")}. They practise the grammar point and the lesson's words. Give each a skill: grammar, vocabulary, articles, word_order, translation or dictation.
- vocabulary: exactly ${COUNTS.wordsCore} core and ${COUNTS.wordsBonus} bonus words (tier "core" / "bonus") for the theme, and exactly ${COUNTS.phrases} useful phrases (more only when the course owner's requirements for this lesson ask for specific extra phrases, never more than ${COUNTS.phrasesMax}) (Redemittel: complete spoken phrases for real situations, with en = what the learner wants to say, de = the phrase, an example sentence in context with its translation, and an optional tip).
  Word cards: de = the German word only with no article (nouns capitalised); article = der, die or das for nouns, null for everything else; plural = for nouns "die Namen" (write "—" when there is no usual plural), for verbs the present-tense line "ich komme · du kommst · er kommt" (show irregular forms), otherwise null; en = the short English meaning (add a note in brackets when two German words share one English word, e.g. "student (male)"); example = one natural sentence with the word in the form taught, simple enough for the level; example_en = its translation; tip = optional hint of at most 80 characters about gender patterns, spelling or usage, else null. No word twice.
- pronunciation: the sound or pattern of the day (focus, a short explanation, 6 to 8 practice words each with a hint on how to say it, and 3 to 4 practice sentences to read aloud). Choose a focus the lesson's own words and sentences let the learner practise.`;

export const PASS_B_SYSTEM = `${SHARED}

PASS B: parts 6 to 9 of the standard (reading, listening, writing, speaking). The request contains pass A (the lesson's grammar, words and exercises): reuse its grammar point and words so the lesson hangs together, but write new sentences.
- reading: a passage (title and German text of the requested length) and exactly ${COUNTS.readingQuestions} questions (skill "reading"; mostly multiple_choice, some typing with a short German answer).
- listening: a dialogue between 2 speakers (from Anna, Jonas, Lena) with ${COUNTS.scriptLines[0]} to ${COUNTS.scriptLines[1]} lines of the requested total length. Each line has speaker, de, and en (an English translation for levels A1 and A2; an empty string at higher levels). Then exactly ${COUNTS.listeningQuestions} questions (skill "listening") that can only be answered by listening.
- writing: the task at the level's kind (what to write, min_words as requested, ${COUNTS.mustInclude[0]} to ${COUNTS.mustInclude[1]} points that must be included, ${COUNTS.usefulPhrases[0]} to ${COUNTS.usefulPhrases[1]} useful phrases, a model_answer in German of at least min_words words and with exactly the number of sentences the task names, and ${COUNTS.rubric[0]} to ${COUNTS.rubric[1]} rubric criteria for correcting it, which include the lesson's grammar point and vocabulary).
- MODEL ANSWER (the automatic check rejects the lesson when it breaks one of these, so count before you answer): write the model_answer first, then count. (1) A sentence ends with . ! or ?. A salutation on its own ("Hallo Jonas!", "Liebe Lena,") and a closing formula with the signature ("Viele Grüße, Anna", "Liebe Grüße, Lena", "Bis bald, Jonas") do NOT count as sentences: when the task says "4 sentences" the model answer has exactly 4 real sentences, plus an optional salutation and an optional closing (a message to a friend should have them). A greeting inside a sentence ("Liebe Lena, ich bin ...") belongs to that sentence. A question counts as a sentence. A task that says "4 to 5 sentences" allows 4 or 5 real ones, never 6. (2) Words: at least min_words, and aim for min_words + 3 so a miscount does not break it. (3) The task text, the must_include points and the model answer agree: the model answer contains every must_include point, and a closing or greeting appears in it only if the task or rubric asks for one. (4) No quotation marks, colons or direct speech inside the model answer.
- speaking: exactly ${COUNTS.drill} drill items (prompt = a cue in the instruction language, target = the German sentence to say, tip optional) practising the lesson's sentences, and a tandem scenario in which Buddy is a conversation PARTNER, not a teacher, on the lesson's theme (title, setting, buddy_role, learner_role, opening_line = Buddy's first German line, target_phrases, target_grammar, topics = follow-up questions or ideas Buddy can raise, end_condition).`;

export const PASS_C_SYSTEM = `${SHARED}

PASS C: the day exam. The request contains pass A (the lesson's grammar, words and phrases): the exam tests them.
- exam: the day exam, with FRESH items: no question, sentence or text may repeat anything else of this lesson (the same sentence with one word changed counts as a repeat; use new names, numbers and situations). This includes the standard phrases: the exam reading text and listening dialogue must not reuse any sentence of the lesson's reading text, listening dialogue or grammar examples (so no "Wie geht es dir?", "Mir geht es gut, danke." or "Ich möchte ein Brot, bitte." if the lesson already shows it: rephrase or use another phrase), and no exam question may be the same as an exercise or warm-up question or its translation: exactly ${COUNTS.examGrammarVocab} grammar_vocab questions on the day's grammar point and words; a short reading passage (2 to 4 sentences) with exactly ${COUNTS.examReadingQuestions} questions (skill "reading"); a short listening script (${COUNTS.examScriptLines[0]} to ${COUNTS.examScriptLines[1]} lines, speakers from Anna, Jonas, Lena, with an English translation per line at A1 and A2, else an empty string) with exactly ${COUNTS.examListeningQuestions} questions (skill "listening"); a short writing task (2 to 3 sentences, min_words 15 to 30, with rubric); a short speaking prompt.`;

export const PASS_D_SYSTEM = `${SHARED}

PASS D: the warm-up, culture note, real-world mission and close day. The request contains pass A (the lesson's grammar and words) and lists the grammar and words of the EARLIER sessions: the warm-up reviews those.
- warmup: the warm-up reviews EARLIER sessions, never this lesson's own content. If the request says this is the first lesson, write the preview: 3 to 5 short points in the instruction language, each completing the sentence "Today you'll learn ..." (preview.points), and no items (an empty list). Otherwise write an empty preview (points = an empty list) and exactly ${COUNTS.warmup} short recall items (gap_fill or multiple_choice) on the earlier grammar points and words listed in the request (one per different earlier session when you can), which stand on their own without any lesson text. Write exactly that number of finished items: never a draft, a placeholder or a note like "this item is replaced" (the list holds ${COUNTS.warmup} items, not ${COUNTS.warmup} + 1), and the wrong options of a gap fill must differ from the answer even when capital letters are ignored.
- culture: a short, accurate, neutral note about life in Germany, Austria or Switzerland tied to the theme (80 to 150 words at low levels), with a reflection question. If unsure of a fact, leave it out. No stereotypes.
- mission: a safe real-world task the learner can do in or around daily life using the lesson (title, task, 2 to 4 steps, report_prompt = what to report back, 2 to 3 success_check lines "I ..."); add a safety_note when the task involves other people or personal data, else an empty string.
- closing: ${COUNTS.closingCovered[0]} to ${COUNTS.closingCovered[1]} "You can now ..." lines for what was covered and one line on what to review tomorrow.`;

export const REVIEW_SYSTEM = `You are a meticulous German teacher and editor. Another model wrote one lesson of "Deutsch mit Buddy", a course for adults who study in English and go from zero to C1, following a fixed 14-part standard. You check every item of the lesson and reply with the JSON object requested and nothing else.

For every item check what applies:
- German: correct, natural, modern standard German; spelling, capitals, punctuation; for cards the article (der/die/das, as in the Duden), the plural or the verb-forms line.
- English: accurate; the English translation matches the German; the English meaning is not misleading.
- Level: words, grammar and text length suit the stated CEFR level and the lesson's grammar point and theme; nothing clearly above the level.
- Instruction language: explanations and instructions are written in the instruction language stated for the level (German examples and words stay German).
- Answers: for typing, ordering and dictation questions check accepted_answers: it must list every other natural, correct answer a learner could give (add the missing ones by fixing the item with the whole new list) and nothing wrong. Answers are checked ignoring case, punctuation and ß/ss, so spelling variants must not be listed. Accepted orders of an ordering question use exactly the words of the question. Choice questions have an empty list. A dictation never accepts digits for number words. An ordering prompt holds only the words separated by " / ", no instruction text. A translation prompt whose English has several equally good German answers ("Hello!") must list them all or be made specific. A typing question in reading or listening (day exam included) must ask for a narrow answer: one word, a number, a time or one fixed phrase from the text. An open one ("answer in one short sentence", "write two things") is fixed by replacing the whole item with a multiple_choice question (the same skill, one right answer, three options that are clearly wrong according to the text, ideally taken from the text at another time, place or person, so exactly one answer is defensible; an empty accepted_answers), NEVER by adding more accepted answers: accepted_answers holds at most 8, and more is a sign that the question is too open. This concerns typing questions only: writing tasks, speaking drills, Tandem scenarios, ordering (sentence-building) and dictation questions are not affected.
- Pronunciation claims: for EVERY statement about how something sounds (the pronunciation part, card tips, drill tips, grammar explanations, example notes), look at the actual spelling of the word and check the claim against its letters, one by one: Tschüs has tsch (English "ch" as in church), not sch; "buchstabiert" has ch and st, no sch. A wrong claim is a clear error: fix it.
- Common traps: the list below is known wrong usage. A lesson must never teach it as correct, not in examples, exercises, model answers, rubrics, missions or exam items: fix any occurrence (it is fine inside a trap that shows it as the wrong sentence).
- Tables: complete and correct (every letter, person or form that belongs in it), cells match their headers.
- Warm-up: in the first lesson a preview of what the lesson really teaches ("Today you'll learn ..."), without questions; in every other lesson recall items on the earlier sessions' grammar and words listed in the request, not on this lesson's own content.
- Course owner's requirements: when the request lists requirements for this lesson, every one must be met by the lesson as written; an item that breaks one is fixed, or needs-human when you cannot fix it alone.
- Questions: exactly one answer is right (apart from the accepted answers); wrong options (distractors) are clearly false but plausible: real words or phrases of the same kind as the right answer that a learner who did not understand could pick. Nonsense or a joke ("Wien ist ein Freund" for a country), an option of the wrong kind (a name when a country is asked) and an option that is also correct, or could be taken from the text as correct, are errors: replace such an option and keep exactly one right answer; for ordering questions the scrambled words are exactly the words of the answer and no other natural word order is also correct; for dictation the answer is a natural sentence that can be read aloud; explanations are true.
- Writing task: the model answer meets its own task: at least min_words words and the number of sentences the task names (a salutation on its own such as "Hallo Jonas!" and a closing formula with the signature such as "Viele Grüße, Anna" do not count as sentences; they frame the message).
- Passages, tasks, scenario, culture note, mission: coherent, useful for learning, original, safe, accurate (a doubtful cultural fact is a problem), neutral; reading and listening questions can only be answered from the text or dialogue; the exam items are fresh and cover the day's grammar and words; the writing rubric covers the lesson's grammar and vocabulary; the Tandem scenario makes Buddy a conversation partner.
- Names: ${NAMES_RULE}

COMMON TRAPS
${trapsForPrompt()}

Give every item exactly one verdict, in the order given, using its id:
- "ok": nothing needs changing. Reason of at most 12 words.
- "fixed": you corrected a clear, objective error. Put the whole corrected item, as a JSON object with exactly the same fields as the original, as text in fixed_json; keep it as close to the original as possible, and say in the reason what was wrong and what you changed.
- "needs-human": something is wrong or doubtful and you cannot settle it with confidence (a word clearly above the level, an ambiguous question, a meaning that depends on taste or region, anything you are not sure about). Leave the item unchanged (fixed_json null) and explain the doubt in the reason. Prefer this over guessing.
Do not rewrite items for style or taste; fix only errors. For "ok" and "needs-human", fixed_json is null.`;

const phaseLabel = (phase: CurriculumRow["phase"]) => (phase === "zero" ? "zero phase, before A1" : phase === "exam" ? "B1 exam preparation" : phase);

/** What the pass or the review is told about this lesson, including the course owner's requirements for it (lesson-notes.ts). */
function lessonSpec(lesson: CurriculumRow, pass?: NotePass): string[] {
  const profile = LEVEL_PROFILES[lesson.phase];
  const lines = [
    `Lesson ${lesson.code} (${phaseLabel(lesson.phase)}; CEFR level ${cefrOf(lesson.phase)})`,
    `Grammar point: ${lesson.grammar}`,
    lesson.theme && lesson.theme !== "—" ? `Theme: ${lesson.theme}` : "Theme: none set. Choose useful B1 vocabulary and situations for the exam tasks named in the grammar point (reading, listening, writing, speaking).",
  ];
  if (lesson.goal) lines.push(`Goal: ${lesson.goal}`);
  lines.push(`Instruction language: ${profile.instructionLanguage}.`);
  if (lesson.phase === "zero") lines.push("This is the zero phase: absolute beginners. Keep every word and sentence very simple (present tense, short sentences).");
  const notes = notesFor(lesson.code, pass);
  if (notes.length) lines.push("", "Requirements from the course owner for this lesson (all of them must be met exactly):", ...notes.map((n) => `- ${n}`));
  return lines;
}

// ---- What came before: the warm-up reviews the earlier sessions.
export const EARLIER_SESSIONS = 6;
export const EARLIER_WORDS = 60;
export interface EarlierContext {
  /** True for the very first lesson of the course (nothing to review). */
  first: boolean;
  grammar: string[];
  words: string[];
}

/** The grammar points of the last few lessons before this one, and their words when those lessons are already written (in this run). */
export function earlierContext(lesson: CurriculumRow, plan: readonly CurriculumRow[], wordsOf: (code: string) => string[] | undefined = () => undefined): EarlierContext {
  const earlier = plan.filter((l) => l.seq < lesson.seq).slice(-EARLIER_SESSIONS);
  return { first: lesson.seq === 0, grammar: earlier.map((l) => `${l.code}: ${l.grammar}`), words: earlier.flatMap((l) => wordsOf(l.code) ?? []).slice(-EARLIER_WORDS) };
}

const earlierLines = (e: EarlierContext): string[] =>
  e.first
    ? ["This is the FIRST lesson of the course: there is nothing earlier to review. The warm-up is the preview."]
    : ["Earlier sessions (the warm-up reviews THESE, not this lesson):", ...e.grammar.map((g) => `- ${g}`), ...(e.words.length ? [`Words from them: ${e.words.join(", ")}`] : [])];

export function passAPrompt(lesson: CurriculumRow): string {
  return [...lessonSpec(lesson, "A"), "", "Write the teaching parts of this lesson (goal, grammar, exercises, vocabulary, pronunciation)."].join("\n");
}

const passASummary = (passA: PassA) => [
  `Grammar: ${passA.grammar.intro.title}. ${passA.grammar.intro.rule_summary}`,
  `Words: ${passA.vocabulary.words.map((c) => `${c.article ? c.article + " " : ""}${c.de}`).join(", ")}`,
  `Phrases: ${passA.vocabulary.phrases.map((x) => x.de).join(" | ")}`,
  `Pronunciation focus: ${passA.pronunciation.focus}`,
];

export function passBPrompt(lesson: CurriculumRow, passA: PassA): string {
  const p = LEVEL_PROFILES[lesson.phase];
  return [
    ...lessonSpec(lesson, "B"),
    `Reading passage length: ${p.readingWords[0]} to ${p.readingWords[1]} words.`,
    `Dialogue length: ${p.listeningWords[0]} to ${p.listeningWords[1]} words in total.`,
    `Writing task: ${p.writingKind}, min_words ${p.writingMinWords[0]} to ${p.writingMinWords[1]}.`,
    "",
    "Pass A of this lesson (use its grammar and words):",
    ...passASummary(passA),
    "",
    "Write parts 6 to 9 of this lesson (reading, listening, writing, speaking).",
  ].join("\n");
}

/** The finished sentences of a lesson's exercises: the exam must not repeat any of them. */
const usedSentences = (passA: PassA) => [...new Set(passA.exercises.items.map((q) => (q.type === "gap_fill" ? q.prompt.replace("___", q.answer) : q.type === "multiple_choice" ? q.prompt : q.answer)))];

export function passCPrompt(lesson: CurriculumRow, passA: PassA): string {
  return [
    ...lessonSpec(lesson, "C"),
    "",
    "Pass A of this lesson (the exam tests its grammar and words):",
    ...passASummary(passA),
    "Already used in this lesson's exercises. Every exam item must be different: other sentences, other names, other numbers, never the same sentence reworded:",
    ...usedSentences(passA).map((x) => `- ${x}`),
    "",
    "Write the day exam of this lesson.",
  ].join("\n");
}

export function passDPrompt(lesson: CurriculumRow, passA: PassA, earlier: EarlierContext): string {
  return [
    ...lessonSpec(lesson, "D"),
    "",
    ...earlierLines(earlier),
    "",
    "Pass A of this lesson (use its grammar and words):",
    ...passASummary(passA),
    "",
    "Write the warm-up, culture note, mission and close day of this lesson.",
  ].join("\n");
}

/** The passage a question refers to: the reviewer needs it to judge the question, but does not give it a verdict in a partial review. */
const passageIdOf = (id: string) => (/(reading|listening)\.q\d+$/.test(id) ? id.replace(/\.q\d+$/, ".passage") : null);

/** `only`: item ids. The review then covers just those items (the corrections made after a first review) and shows the passage a question refers to as context. */
export function reviewPrompt(lesson: CurriculumRow, content: Lesson, lint: LintIssue[], earlier: EarlierContext, only?: string[]): string {
  const p = LEVEL_PROFILES[lesson.phase];
  const all = enumerateItems(lesson.code, content);
  const wanted = only ? new Set(only) : null;
  const shown = all.filter((i) => !wanted || wanted.has(i.id));
  const items = shown.map((i) => ({ id: i.id, unit: i.unit, value: valueOf(content, i) }));
  const contextIds = new Set(wanted ? shown.flatMap((i) => passageIdOf(i.id) ?? []).filter((id) => !wanted.has(id)) : []);
  const context = all.filter((i) => contextIds.has(i.id)).map((i) => ({ id: i.id, unit: i.unit, value: valueOf(content, i) }));
  const hintLines = lint.filter((l) => !wanted || wanted.has(l.id));
  const hints = hintLines.length ? hintLines.map((l) => `- ${l.id}: ${l.message}`).join("\n") : "- none";
  return [
    ...lessonSpec(lesson),
    "",
    ...earlierLines(earlier),
    "",
    `Expected: reading ${p.readingWords[0]} to ${p.readingWords[1]} words; dialogue ${p.listeningWords[0]} to ${p.listeningWords[1]} words; writing task ${p.writingKind} with min_words ${p.writingMinWords[0]} to ${p.writingMinWords[1]}.`,
    "",
    "Automatic checks (hints only, they can be wrong):",
    hints,
    ...(wanted
      ? ["", "This is a RE-REVIEW. The course owner corrected the items below after the first review. Check only these items, by the same rules, and give each exactly one verdict. The rest of the lesson was already checked and is not shown, except the text or dialogue a question refers to (context: no verdict needed).", ...(context.length ? ["", "Context:", JSON.stringify(context)] : [])]
      : []),
    "",
    `Items to check (${items.length}), in lesson order:`,
    JSON.stringify(items),
  ].join("\n");
}
