import type { CurriculumRow } from "./curriculum-rows.ts";
import type { Card, Lesson, PassA, PassB, Question } from "./lesson-schema.ts";

// A complete, valid zero-phase lesson for tests: every part present, every count right, no lint errors or warnings.

export const lessonRow = (over: Partial<CurriculumRow> = {}): CurriculumRow => ({
  seq: 8,
  code: "Z9",
  kind: "lesson",
  phase: "zero",
  grammar: "Irregular Präsens + möchten",
  theme: "Essen & Trinken",
  goal: "Order food and drinks",
  word_target: 18,
  ...over,
});

const NOUNS: [string, string, string][] = [
  ["der", "Kaffee", "coffee"], ["der", "Tee", "tea"], ["das", "Brot", "bread"], ["die", "Milch", "milk"], ["das", "Wasser", "water"], ["der", "Kuchen", "cake"],
  ["die", "Suppe", "soup"], ["der", "Apfel", "apple"], ["die", "Banane", "banana"], ["das", "Ei", "egg"], ["der", "Saft", "juice"], ["die", "Butter", "butter"],
  ["das", "Obst", "fruit"], ["der", "Käse", "cheese"], ["die", "Tasse", "cup"], ["der", "Salat", "salad"], ["der", "Reis", "rice"], ["der", "Fisch", "fish"],
];

const card = (n: [string, string, string], i: number): Card => ({
  tier: i < 12 ? "core" : "bonus",
  en: n[2],
  article: n[0] as "der" | "die" | "das",
  de: n[1],
  plural: `die ${n[1]}s`,
  example: `Das ist ${n[1]}.`,
  example_en: `That is ${n[2]}.`,
  tip: null,
});

const mc = (i: number): Question => ({ skill: "vocabulary", type: "multiple_choice", prompt: `What does “${NOUNS[i][1]}” mean?`, answer: NOUNS[i][2], distractors: ["one", "two", "three"], explanation: `${NOUNS[i][1]} means ${NOUNS[i][2]}.` });
const gap = (i: number): Question => ({ skill: "grammar", type: "gap_fill", prompt: `Ich ___ ${NOUNS[i][1]}.`, answer: "trinke", distractors: ["trinkst", "trinkt"], explanation: "With ich the verb ends in -e." });
const order = (i: number): Question => ({ skill: "word_order", type: "ordering", prompt: `${NOUNS[i][1]} / ich / trinke`, answer: `Ich trinke ${NOUNS[i][1]}.`, distractors: [], explanation: "The verb is the second word." });
const translate = (i: number): Question => ({ skill: "translation", type: "typing", prompt: `I drink ${NOUNS[i][2]}.`, answer: `Ich trinke ${NOUNS[i][1]}.`, distractors: [], explanation: "Ich trinke = I drink." });
const dictate = (i: number): Question => ({ skill: "dictation", type: "dictation", prompt: "Listen and write the sentence.", answer: `Ich trinke gern ${NOUNS[i][1]}.`, distractors: [], explanation: "Capital letter for the noun." });
export const articleQuestion = (i: number): Question => ({ skill: "articles", type: "multiple_choice", prompt: `___ ${NOUNS[i][1]}`, answer: NOUNS[i][0], distractors: ["der", "die", "das"].filter((a) => a !== NOUNS[i][0]), explanation: `${NOUNS[i][1]} is ${NOUNS[i][0]}.` });
const seq = (n: number, f: (i: number) => Question, from = 0) => Array.from({ length: n }, (_, i) => f(from + i));

const script = (lines: [string, string][]) => lines.map(([speaker, de]) => ({ speaker, de, en: `English for: ${de}` }));

export function validPassA(): PassA {
  return {
    goal: { can_do: "I can order a drink and something to eat in a café." },
    warmup: { items: [gap(0), gap(1), mc(2)].map((q, i) => ({ ...q, prompt: q.prompt + " ".repeat(i) })) },
    grammar: {
      intro: {
        title: "Verbs with ich",
        explanation: ["The verb ends in -e after ich and the verb is the second word in the sentence.", "You do not move it to the end, and this is the pattern that you will see in all of the lessons."],
        rule_summary: "Ich + verb stem + -e.",
      },
      examples: Array.from({ length: 6 }, (_, i) => ({ de: `Ich trinke ${NOUNS[i][1]}.`, en: `I drink ${NOUNS[i][2]}.`, note: null })),
      traps: Array.from({ length: 3 }, (_, i) => ({ wrong: `Ich trinken ${NOUNS[i][1]}.`, right: `Ich trinke ${NOUNS[i][1]}.`, why: "After ich the ending is -e." })),
    },
    exercises: { items: [...seq(6, gap), ...seq(4, mc, 4), ...seq(3, order, 6), ...seq(3, translate, 9), ...seq(3, dictate, 12)].map((q, i) => ({ ...q, prompt: q.type === "dictation" ? q.prompt + " ".repeat(i) : q.prompt })) },
    vocabulary: {
      words: NOUNS.map(card),
      phrases: Array.from({ length: 5 }, (_, i) => ({ en: `Phrase ${i + 1} meaning`, de: `Ich hätte gern ${NOUNS[i][1]}, bitte.`, example: `Ich hätte gern ${NOUNS[i][1]}, bitte.`, example_en: `I would like ${NOUNS[i][2]}, please.`, tip: null })),
    },
    pronunciation: {
      focus: "The sound ä",
      explanation: "Say ä like the e in the English word bed, with the mouth a little open.",
      words: Array.from({ length: 6 }, (_, i) => ({ de: NOUNS[i][1], hint: "Say it slowly and then quickly." })),
      sentences: ["Ich trinke Kaffee.", "Das ist der Käse.", "Ich esse Brot."],
    },
  };
}

export function validPassB(): PassB {
  return {
    reading: {
      passage: { title: "Im Café", text: "Anna ist im Café. Sie trinkt Kaffee und isst Brot. Jonas trinkt Tee und isst Kuchen. Die Milch ist kalt. Das Wasser ist gut. Anna und Jonas sind froh." },
      questions: [
        { skill: "reading", type: "multiple_choice", prompt: "What does Anna drink?", answer: "coffee", distractors: ["tea", "milk"], explanation: "Anna trinkt Kaffee." },
        { skill: "reading", type: "multiple_choice", prompt: "What does Jonas eat?", answer: "cake", distractors: ["bread", "soup"], explanation: "Jonas isst Kuchen." },
        { skill: "reading", type: "multiple_choice", prompt: "How is the milk?", answer: "cold", distractors: ["hot", "sweet"], explanation: "Die Milch ist kalt." },
        { skill: "reading", type: "typing", prompt: "Who drinks tea? Answer in German.", answer: "Jonas", distractors: [], explanation: "Jonas trinkt Tee." },
        { skill: "reading", type: "typing", prompt: "What do Anna and Jonas feel? Answer in German.", answer: "froh", distractors: [], explanation: "Anna und Jonas sind froh." },
      ],
    },
    listening: {
      passage: {
        title: "Beim Bestellen",
        speakers: ["Anna", "Jonas"],
        script: script([["Anna", "Hallo Jonas, was trinkst du heute im Café?"], ["Jonas", "Ich trinke Kaffee, und du, was trinkst du?"], ["Anna", "Ich nehme einen Tee mit Milch, bitte."], ["Jonas", "Möchtest du auch ein Stück Kuchen?"], ["Anna", "Ja, gern, den Kuchen nehme ich sehr gern."], ["Jonas", "Dann bestelle ich noch ein Brot für uns."]]),
      },
      questions: Array.from({ length: 5 }, (_, i) => ({ skill: "listening" as const, type: "multiple_choice" as const, prompt: `Listening question ${i + 1}?`, answer: "Kaffee", distractors: ["Tee", "Milch"], explanation: "Jonas trinkt Kaffee." })),
    },
    writing: {
      task: "Write a short message to a friend and say what you drink and what you eat.",
      min_words: 30,
      must_include: ["what you drink", "what you eat", "a greeting"],
      useful_phrases: ["Ich trinke gern ...", "Ich esse ...", "Liebe Anna,"],
      model_answer: "Liebe Anna, ich trinke gern Kaffee und Tee. Am Morgen esse ich Brot mit Butter und Käse. Mittags esse ich Suppe oder Salat. Am Abend trinke ich Wasser und esse Reis. Und du? Was trinkst du? Viele Grüße, Jonas",
      rubric: ["Verb ending -e after ich", "Capital letters for nouns", "At least 30 words", "Uses words of the lesson"],
    },
    speaking: {
      drill: Array.from({ length: 5 }, (_, i) => ({ prompt: `Say: I drink ${NOUNS[i][2]}.`, target: `Ich trinke ${NOUNS[i][1]}.`, tip: null })),
      tandem: {
        title: "At the café",
        setting: "You and Buddy meet in a small café and order something.",
        buddy_role: "A friendly guest at the next table.",
        learner_role: "A customer who orders.",
        opening_line: "Hallo! Was trinkst du heute?",
        target_phrases: ["Ich hätte gern ...", "Ich trinke ..."],
        target_grammar: "ich + verb stem + -e",
        topics: ["Was isst du gern?", "Trinkst du Kaffee oder Tee?"],
        end_condition: "The learner has ordered a drink and a snack.",
      },
    },
    culture: { title: "Coffee in Germany", note: "Many people in Germany drink coffee in the morning and in the afternoon, and a cake is often part of it.", reflection_question: "What do you usually drink in the morning?" },
    mission: {
      title: "Order in German",
      task: "Order a drink in German the next time you are in a café or at home with a friend.",
      steps: ["Say Ich hätte gern ... out loud.", "Add bitte."],
      report_prompt: "Tell Buddy what you said.",
      success_check: ["I said a full sentence", "I used bitte"],
      safety_note: null,
    },
    exam: {
      grammar_vocab: Array.from({ length: 6 }, (_, i) => ({ ...(i % 2 ? mc(i) : gap(i)), prompt: (i % 2 ? mc(i) : gap(i)).prompt + " ".repeat(i) })),
      reading: {
        passage: { text: "Lena trinkt Tee. Sie isst Brot. Der Tee ist heiß." },
        questions: [
          { skill: "reading", type: "multiple_choice", prompt: "What does Lena drink?", answer: "tea", distractors: ["coffee", "milk"], explanation: "Lena trinkt Tee." },
          { skill: "reading", type: "multiple_choice", prompt: "How is the tea?", answer: "hot", distractors: ["cold", "sweet"], explanation: "Der Tee ist heiß." },
        ],
      },
      listening: {
        passage: { script: script([["Anna", "Was isst du?"], ["Lena", "Ich esse Salat."], ["Anna", "Ich auch."]]) },
        questions: [
          { skill: "listening", type: "multiple_choice", prompt: "What does Lena eat?", answer: "salad", distractors: ["bread", "fish"], explanation: "Lena isst Salat." },
          { skill: "listening", type: "multiple_choice", prompt: "Who eats the same?", answer: "Anna", distractors: ["Jonas", "nobody"], explanation: "Anna sagt: Ich auch." },
        ],
      },
      writing: { task: "Write two sentences about what you drink.", min_words: 15, rubric: ["Verb ending -e", "Capital letters"] },
      speaking: { prompt: "Say what you drink and what you eat.", target_hint: "Ich trinke ... und ich esse ..." },
    },
    closing: { covered: ["You can now say what you drink.", "You can now order with Ich hätte gern.", "You can now use ich + verb."], review_tomorrow: "Review the ich endings." },
  };
}

export const validLesson = (): Lesson => ({ ...validPassA(), ...validPassB() });
