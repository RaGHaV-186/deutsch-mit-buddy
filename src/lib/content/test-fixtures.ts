import type { CurriculumRow } from "./curriculum-rows.ts";
import { QUESTION_PLAN, type GeneratedCard, type GeneratedQuestion, type LessonContent } from "./schema.ts";

export const lessonRow = (over: Partial<CurriculumRow> = {}): CurriculumRow => ({
  seq: 8,
  code: "Z9",
  kind: "lesson",
  phase: "zero",
  grammar: "Irregular Präsens + möchten",
  theme: "Essen & Trinken",
  goal: "Order food and drinks",
  word_target: 15,
  ...over,
});

const NOUNS: [string, string, string, string][] = [
  ["der", "Kaffee", "coffee", "Ich trinke einen Kaffee."],
  ["der", "Tee", "tea", "Der Tee ist heiß."],
  ["das", "Brot", "bread", "Das Brot ist frisch."],
  ["die", "Milch", "milk", "Die Milch ist kalt."],
  ["das", "Wasser", "water", "Ich möchte ein Wasser."],
  ["der", "Kuchen", "cake", "Der Kuchen schmeckt gut."],
  ["die", "Suppe", "soup", "Die Suppe ist heiß."],
  ["der", "Apfel", "apple", "Ich esse einen Apfel."],
  ["die", "Banane", "banana", "Die Banane ist gelb."],
  ["das", "Ei", "egg", "Das Ei ist klein."],
];
const EXTRAS: [string, string, string, string][] = [
  ["der", "Saft", "juice", "Der Saft ist süß."],
  ["die", "Butter", "butter", "Die Butter ist weich."],
  ["das", "Obst", "fruit", "Das Obst ist gesund."],
  ["der", "Käse", "cheese", "Der Käse schmeckt gut."],
  ["die", "Tasse", "cup", "Die Tasse ist voll."],
];

const card = (n: [string, string, string, string], tier: "core" | "bonus"): GeneratedCard => ({
  tier,
  en: n[2],
  article: n[0] as "der" | "die" | "das",
  de: n[1],
  plural: `die ${n[1]}s`,
  example: n[3],
  example_en: `Example for ${n[2]}.`,
  tip: null,
});

export function validContent(over: { cards?: GeneratedCard[]; questions?: GeneratedQuestion[] } = {}): LessonContent {
  const cards = [...NOUNS.map((n) => card(n, "core")), ...EXTRAS.map((n) => card(n, "bonus"))];
  const questions: GeneratedQuestion[] = [];
  let k = 0;
  for (const plan of QUESTION_PLAN) {
    for (let i = 0; i < plan.count; i++, k++) {
      const base = { skill: plan.skill, type: plan.type, explanation: "Because the lesson says so." };
      if (plan.type === "multiple_choice" && plan.skill === "articles") questions.push({ ...base, prompt: `___ ${NOUNS[i].at(1)} (${k})`, answer: "der", distractors: ["die", "das"] });
      else if (plan.type === "multiple_choice") questions.push({ ...base, prompt: `What does “${NOUNS[i][1]}” mean? (${k})`, answer: NOUNS[i][2], distractors: ["one", "two", "three"] });
      else if (plan.type === "gap_fill") questions.push({ ...base, prompt: `Ich ___ Kaffee ${k}.`, answer: "trinke", distractors: ["trinkst", "trinkt"] });
      else if (plan.type === "ordering") questions.push({ ...base, prompt: "Kaffee / ich / trinke", answer: "Ich trinke Kaffee.", distractors: [] });
      else questions.push({ ...base, prompt: `I drink coffee ${k}.`, answer: "Ich trinke Kaffee.", distractors: [] });
    }
  }
  return { cards: over.cards ?? cards, questions: over.questions ?? questions };
}
