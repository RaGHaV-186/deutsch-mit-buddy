import { enumerateItems, valueOf, type UnitName } from "./lesson-items.ts";
import { PARTS, PART_NUMBER, type Lesson, type PartName } from "./lesson-schema.ts";

// Readable text for a lesson: used by the Markdown export (so the German can be checked in any editor) and by the preview page.
// One formatting function per unit, so both show exactly the same thing.

type V = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const bullets = (items: string[]) => items.map((x) => `- ${x}`);

function question(q: V): string[] {
  const out = [`${q.prompt}`, `  Answer: ${q.answer}`];
  if (q.distractors?.length) out.push(`  Wrong options: ${q.distractors.join(" | ")}`);
  out.push(`  (${q.skill} · ${String(q.type).replace("_", " ")}) Why: ${q.explanation}`);
  return out;
}

function script(lines: V[]): string[] {
  return lines.flatMap((l) => [`${l.speaker}: ${l.de}`, ...(l.en ? [`    ${l.en}`] : [])]);
}

export function unitLines(unit: UnitName, v: V): string[] {
  switch (unit) {
    case "goal":
      return [v.can_do];
    case "question":
      return question(v);
    case "card":
      return [`${v.article ? v.article + " " : ""}${v.de}${v.plural ? "   (" + v.plural + ")" : ""}  =  ${v.en}   [${v.tier}]`, `  ${v.example}`, `  ${v.example_en}`, ...(v.tip ? [`  Tip: ${v.tip}`] : [])];
    case "phrase":
      return [`${v.de}   =   ${v.en}`, `  ${v.example}`, `  ${v.example_en}`, ...(v.tip ? [`  Tip: ${v.tip}`] : [])];
    case "example":
      return [`${v.de}`, `  ${v.en}${v.note ? "   (" + v.note + ")" : ""}`];
    case "trap":
      return [`Wrong: ${v.wrong}`, `Right: ${v.right}`, `Why: ${v.why}`];
    case "grammarIntro":
      return [`${v.title}`, ...v.explanation, `Rule: ${v.rule_summary}`];
    case "pronunciation":
      return [`Focus: ${v.focus}`, v.explanation, "Words:", ...bullets(v.words.map((w: V) => `${w.de}: ${w.hint}`)), "Sentences:", ...bullets(v.sentences)];
    case "readingPassage":
      return [`${v.title}`, v.text];
    case "listeningPassage":
      return [`${v.title} (${v.speakers.join(", ")})`, ...script(v.script)];
    case "writing":
      return [v.task, `Minimum: ${v.min_words} words`, "Must include:", ...bullets(v.must_include), "Useful phrases:", ...bullets(v.useful_phrases), `Model answer: ${v.model_answer}`, "Rubric:", ...bullets(v.rubric)];
    case "drill":
      return [`${v.prompt}`, `  Say: ${v.target}`, ...(v.tip ? [`  Tip: ${v.tip}`] : [])];
    case "tandem":
      return [`${v.title}`, `Setting: ${v.setting}`, `Buddy: ${v.buddy_role}`, `Learner: ${v.learner_role}`, `Buddy opens with: ${v.opening_line}`, `Target phrases: ${v.target_phrases.join(" | ")}`, `Target grammar: ${v.target_grammar}`, "Topics:", ...bullets(v.topics), `Ends when: ${v.end_condition}`];
    case "culture":
      return [`${v.title}`, v.note, `Think about it: ${v.reflection_question}`];
    case "mission":
      return [`${v.title}`, v.task, "Steps:", ...bullets(v.steps), `Report back: ${v.report_prompt}`, "Success check:", ...bullets(v.success_check), ...(v.safety_note ? [`Safety: ${v.safety_note}`] : [])];
    case "examReadingPassage":
      return [v.text];
    case "examListeningPassage":
      return script(v.script);
    case "examWriting":
      return [v.task, `Minimum: ${v.min_words} words`, "Rubric:", ...bullets(v.rubric)];
    case "examSpeaking":
      return [v.prompt, ...(v.target_hint ? [`Hint: ${v.target_hint}`] : [])];
    case "closing":
      return ["You covered:", ...bullets(v.covered), `Review tomorrow: ${v.review_tomorrow}`];
  }
}

export const PART_TITLES: Record<PartName, string> = {
  goal: "Can-do goal",
  warmup: "Warm-up: spaced grammar review",
  grammar: "Grammar",
  exercises: "Exercises",
  vocabulary: "Vocabulary and useful phrases",
  pronunciation: "Pronunciation focus",
  reading: "Reading",
  listening: "Listening",
  writing: "Writing task",
  speaking: "Speaking drill and Tandem scenario",
  culture: "Culture note",
  mission: "Real-world mission",
  exam: "Day exam",
  closing: "Close day",
};

export interface ItemMark {
  status: "ok" | "fixed" | "needs-human";
  reason: string;
}

/** The whole lesson as Markdown. `marks` (item id to verdict) adds FIXED / NEEDS HUMAN notes next to the items they concern. */
export function lessonToMarkdown(meta: { code: string; phase: string; theme: string; grammar: string }, lesson: Lesson, marks: Map<string, ItemMark> = new Map()): string {
  const items = enumerateItems(meta.code, lesson);
  const out: string[] = [`# ${meta.code} · ${meta.theme}`, "", `Level: ${meta.phase}  ·  Grammar point: ${meta.grammar}`, ""];
  for (const part of PARTS) {
    out.push(`## ${PART_NUMBER[part]}. ${PART_TITLES[part]}`, "");
    for (const item of items.filter((i) => i.part === part)) {
      const mark = marks.get(item.id);
      const note = mark && mark.status !== "ok" ? `   ⟵ ${mark.status === "fixed" ? "FIXED" : "NEEDS HUMAN"}: ${mark.reason}` : "";
      const lines = unitLines(item.unit, valueOf(lesson, item) as V);
      out.push(`**${item.label}**  \`${item.id}\`${note}`, "", ...lines.map((l) => (l.startsWith("- ") || l.startsWith("  ") ? l : `${l}`)).map((l) => (l.trim() === "" ? l : l)), "");
    }
  }
  return out.join("\n");
}
