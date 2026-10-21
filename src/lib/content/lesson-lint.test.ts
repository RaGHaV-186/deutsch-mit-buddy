import { describe, expect, it } from "vitest";
import { errorIds, germanShare, lessonErrors, lintLesson } from "./lesson-lint.ts";
import type { Lesson, Phase } from "./lesson-schema.ts";
import { validLesson } from "./test-fixtures.ts";

const lint = (mutate: (l: Lesson) => void, phase: Phase = "zero") => {
  const l = validLesson();
  mutate(l);
  return lintLesson("Z9", phase, l);
};
const ruleOf = (issues: { rule: string; id: string }[]) => issues.map((i) => `${i.id}:${i.rule}`);

describe("a complete lesson", () => {
  it("has no errors and no warnings", () => {
    expect(lintLesson("Z9", "zero", validLesson())).toEqual([]);
  });
});

describe("counts: a lesson with the wrong shape cannot publish", () => {
  it.each([
    ["words", (l: Lesson) => l.vocabulary.words.splice(14), null, "word-count"],
    ["phrases", (l: Lesson) => l.vocabulary.phrases.pop(), null, "phrase-count"],
    ["warm-up", (l: Lesson) => l.warmup.items.pop(), null, "warmup-count"],
    ["examples", (l: Lesson) => l.grammar.examples.splice(4), null, "example-count"],
    ["traps", (l: Lesson) => l.grammar.traps.splice(1), null, "trap-count"],
    ["exercises", (l: Lesson) => l.exercises.items.pop(), null, "exercise-count"],
    ["pronunciation words", (l: Lesson) => l.pronunciation.words.splice(5), null, "pron-words"],
    ["reading questions", (l: Lesson) => l.reading.questions.pop(), null, "reading-count"],
    ["listening questions", (l: Lesson) => l.listening.questions.pop(), null, "listening-count"],
    ["dialogue lines", (l: Lesson) => l.listening.passage.script.splice(5), null, "script-lines"],
    ["speaking drill", (l: Lesson) => l.speaking.drill.pop(), null, "drill-count"],
    ["exam grammar/vocabulary", (l: Lesson) => l.exam.grammar_vocab.pop(), null, "exam-gv-count"],
    ["exam reading questions", (l: Lesson) => l.exam.reading.questions.pop(), null, "exam-reading-count"],
    ["exam listening questions", (l: Lesson) => l.exam.listening.questions.pop(), null, "exam-listening-count"],
  ])("%s", (_name, shrink, _grow, rule) => {
    const issues = lint(shrink as (l: Lesson) => void);
    expect(issues.some((i) => i.id === "lesson" && i.level === "error" && i.rule === rule || (rule === "exercise-count" && i.rule === "exercise-mix"))).toBe(true);
  });

  it("the mix of exercise types is checked, not only the total", () => {
    const issues = lint((l) => {
      l.exercises.items[0] = { ...l.exercises.items[0], type: "multiple_choice", distractors: ["a", "b"] }; // a gap fill turned into multiple choice: total still 19
    });
    expect(ruleOf(issues)).toEqual(expect.arrayContaining(["lesson:exercise-mix"]));
    expect(lessonErrors(issues).length).toBeGreaterThan(0);
  });

  it("a lesson with too many words is refused too", () => {
    const issues = lint((l) => {
      for (let i = 0; i < 3; i++) l.vocabulary.words.push({ ...l.vocabulary.words[0], de: `Extra${i}`, example: `Extra${i} ist hier.` });
    });
    expect(ruleOf(issues)).toContain("lesson:word-count");
  });
});

describe("level bands", () => {
  it("a reading text or dialogue of the wrong length for the level is flagged for the reviewer", () => {
    const long = lint((l) => (l.reading.passage.text = Array(120).fill("Anna trinkt Kaffee und isst Brot.").join(" ")));
    expect(ruleOf(long)).toContain("Z9#reading.passage:reading-length");
    const short = lint((l) => (l.listening.passage.script = l.listening.passage.script.slice(0, 6).map((x) => ({ ...x, de: "Hallo Brot." }))));
    expect(ruleOf(short)).toContain("Z9#listening.passage:listening-length");
  });

  it("the same text is fine at B1 that is too long at A1", () => {
    const text = Array(25).fill("Anna trinkt Kaffee und isst Brot im Café.").join(" "); // ~200 words
    const a1 = lint((l) => (l.reading.passage.text = text), "A1");
    const b1 = lint((l) => (l.reading.passage.text = text), "B1");
    expect(ruleOf(a1)).toContain("Z9#reading.passage:reading-length");
    expect(ruleOf(b1)).not.toContain("Z9#reading.passage:reading-length");
  });

  it("writing tasks grow with the level: 30 words suits zero/A1, not B1 or C1", () => {
    expect(ruleOf(lint(() => {}, "A1"))).not.toContain("Z9#writing:writing-length");
    expect(ruleOf(lint(() => {}, "B1"))).toContain("Z9#writing:writing-length");
    expect(ruleOf(lint(() => {}, "C1"))).toContain("Z9#writing:writing-length");
  });

  it("a model answer shorter than the task asks for is flagged", () => {
    expect(ruleOf(lint((l) => (l.writing.model_answer = "Ich trinke Kaffee.")))).toContain("Z9#writing:model-answer-length");
  });

  it("dictation sentences stay short at low levels", () => {
    const issues = lint((l) => {
      const d = l.exercises.items.find((q) => q.type === "dictation")!;
      d.answer = "Ich trinke gern Kaffee und esse dazu ein Brot mit Butter.";
    });
    expect(issues.some((i) => i.rule === "dictation-length")).toBe(true);
  });
});

describe("instruction language", () => {
  it("measures the share of German function words, and says nothing when there is too little text", () => {
    expect(germanShare("The verb is the second word and you do not move it to the end of the sentence.")).toBe(0);
    expect(germanShare("Das Verb steht immer an zweiter Stelle und du darfst es nicht ans Ende stellen, auch wenn der Satz lang ist.")).toBeGreaterThan(0.8);
    expect(germanShare("Short.")).toBeNull();
  });

  it("English explanations are fine at zero, a warning at B2 (which is German only)", () => {
    expect(lint(() => {}, "zero").filter((i) => i.rule === "instruction-language")).toEqual([]);
    const b2 = lint(() => {}, "B2").filter((i) => i.rule === "instruction-language");
    expect(b2.length).toBeGreaterThan(0);
    expect(b2[0].message).toMatch(/German only/);
  });

  it("German explanations at zero are flagged", () => {
    const issues = lint((l) => (l.grammar.intro.explanation = ["Das Verb steht immer an zweiter Stelle und du darfst es nicht ans Ende des Satzes stellen, auch wenn der Satz lang ist."]));
    expect(ruleOf(issues)).toContain("Z9#grammar.intro:instruction-language");
  });
});

describe("the lesson hangs together", () => {
  it("a reading text or dialogue that uses none of the lesson's words is flagged", () => {
    const issues = lint((l) => {
      l.reading.passage.text = "Der Hund läuft schnell durch den großen Park und spielt dort mit dem kleinen Ball am Morgen.";
    });
    expect(ruleOf(issues)).toContain("Z9#reading.passage:reading-vocabulary");
  });
});

describe("items", () => {
  it("cards: article left in the word, noun capitals, plural and verb-forms lines, the example uses the word", () => {
    const issues = lint((l) => {
      l.vocabulary.words[0].de = "der Kaffee";
      l.vocabulary.words[1].de = "tee";
      l.vocabulary.words[2].plural = null;
      l.vocabulary.words[3].plural = "Milchs";
      Object.assign(l.vocabulary.words[4], { article: null, en: "to drink", de: "trinken", plural: null, example: "Ich trinke Tee." });
      l.vocabulary.words[5].example = "Hier ist es schön";
    });
    expect(ruleOf(issues)).toEqual(expect.arrayContaining(["Z9#vocabulary.w01:article-in-de", "Z9#vocabulary.w02:noun-capital", "Z9#vocabulary.w03:plural-missing", "Z9#vocabulary.w04:plural-format", "Z9#vocabulary.w05:verb-forms", "Z9#vocabulary.w06:example-word", "Z9#vocabulary.w06:example-punctuation"]));
  });

  it("the same word twice is an error on the second", () => {
    expect(ruleOf(lint((l) => (l.vocabulary.words[3].de = "kaffee")))).toContain("Z9#vocabulary.w04:duplicate-word");
  });

  it("questions in any part: options, gaps, scrambled sentences, article answers", () => {
    const issues = lint((l) => {
      l.exercises.items[0].prompt = "Ich trinke Kaffee."; // gap fill without a gap
      l.exercises.items[6].distractors = ["a"]; // multiple choice with one wrong option
      const ordering = l.exercises.items.find((q) => q.type === "ordering")!;
      ordering.prompt = "Kaffee / ich";
      l.reading.questions[0].distractors = ["coffee", "tea"]; // a wrong option equals the answer
      l.exam.grammar_vocab[1].distractors = ["x", "X", "y"]; // not distinct
    });
    const rules = ruleOf(issues);
    expect(rules).toEqual(expect.arrayContaining(["Z9#exercises.01:gap-missing", "Z9#exercises.07:mc-options", "Z9#reading.q1:distractor-is-answer", "Z9#exam.gv2:distractors-distinct"]));
    expect(issues.some((i) => i.rule === "ordering-words")).toBe(true);
  });

  it("a trap whose wrong and right versions are the same is an error", () => {
    expect(ruleOf(lint((l) => (l.grammar.traps[0].wrong = l.grammar.traps[0].right)))).toContain("Z9#grammar.trap1:trap-same");
  });

  it("errorIds lists items with errors, not warnings", () => {
    const issues = lint((l) => {
      l.vocabulary.words[1].example = "Hier ist es schön"; // warnings only
      l.vocabulary.words[2].de = "brot"; // error
    });
    const ids = errorIds(issues);
    expect(ids.has("Z9#vocabulary.w03")).toBe(true);
    expect(ids.has("Z9#vocabulary.w02")).toBe(false);
  });
});
