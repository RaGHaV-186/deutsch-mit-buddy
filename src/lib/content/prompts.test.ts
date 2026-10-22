import { describe, expect, it } from "vitest";
import { COMMON_TRAPS } from "./common-traps.ts";
import { LESSON_NOTES, notesFor } from "./lesson-notes.ts";
import { earlierContext, PASS_A_SYSTEM, PASS_B_SYSTEM, PASS_C_SYSTEM, PASS_D_SYSTEM, passAPrompt, passBPrompt, passCPrompt, passDPrompt, REVIEW_SYSTEM, reviewPrompt } from "./prompts.ts";
import { lessonRow, validLesson, validPassA } from "./test-fixtures.ts";

const plan = Array.from({ length: 9 }, (_, i) => lessonRow({ code: `Z${i + 1}`, seq: i, grammar: `Grammar of Z${i + 1}` }));
const [z1, z2, z3, , , , , , z9] = plan;

describe("the earlier sessions the warm-up reviews", () => {
  it("are the grammar points of the last six lessons before this one, with their words when known", () => {
    const e = earlierContext(z9, plan, (code) => (code === "Z8" ? ["der Tisch", "die Uhr"] : undefined));
    expect(e.first).toBe(false);
    expect(e.grammar).toEqual(["Z3: Grammar of Z3", "Z4: Grammar of Z4", "Z5: Grammar of Z5", "Z6: Grammar of Z6", "Z7: Grammar of Z7", "Z8: Grammar of Z8"]);
    expect(e.words).toEqual(["der Tisch", "die Uhr"]);
  });
  it("are nothing for the first lesson", () => {
    expect(earlierContext(z1, plan)).toEqual({ first: true, grammar: [], words: [] });
  });
  it("go to pass D and say so for the first lesson", () => {
    const text = passDPrompt(z3, validPassA(), earlierContext(z3, plan, () => ["das Brot"]));
    expect(text).toContain("Earlier sessions (the warm-up reviews THESE, not this lesson):");
    expect(text).toContain("- Z1: Grammar of Z1");
    expect(text).toContain("das Brot");
    expect(passDPrompt(z1, validPassA(), earlierContext(z1, plan))).toContain("FIRST lesson of the course");
  });
  it("go to the reviewer too", () => {
    expect(reviewPrompt(z2, validLesson(), [], earlierContext(z2, plan))).toContain("- Z1: Grammar of Z1");
  });
});

describe("the day exam writer", () => {
  it("is shown the sentences of the exercises, so it does not repeat them", () => {
    const a = validPassA();
    const text = passCPrompt(z2, a);
    expect(text).toContain("Already used in this lesson's exercises");
    expect(text).toContain("- Ich trinke Kaffee."); // an ordering answer
    expect(text).toContain("- Ich trinke Kaffee."); // a gap fill, filled in, is the same sentence: listed once
    expect(text.match(/- Ich trinke Kaffee\./g)).toHaveLength(1);
  });
});

describe("the course owner's notes for a lesson", () => {
  const z1Row = lessonRow({ code: "Z1", seq: 0 });
  const z2Row = lessonRow({ code: "Z2", seq: 1 });
  it("reach the passes they name, and only those", () => {
    expect(passAPrompt(z1Row)).toContain("alphabet with the German letter names");
    expect(passAPrompt(z1Row)).toContain("Requirements from the course owner for this lesson");
    expect(passBPrompt(z1Row, validPassA())).not.toContain("alphabet with the German letter names");
    expect(passBPrompt(z2Row, validPassA())).toContain("3 to 5 natural sentences");
    expect(passAPrompt(z2Row)).not.toContain("3 to 5 natural sentences");
    expect(passAPrompt(lessonRow({ code: "Z4", seq: 3 }))).not.toContain("Requirements from the course owner");
  });
  it("all reach the reviewer, who checks them", () => {
    const text = reviewPrompt(z2Row, validLesson(), [], earlierContext(z2Row, plan));
    for (const note of notesFor("Z2")) expect(text).toContain(note);
    expect(REVIEW_SYSTEM).toContain("Course owner's requirements");
  });
  it("every note names a pass and has text", () => {
    for (const [code, notes] of Object.entries(LESSON_NOTES)) for (const n of notes) expect(n.passes.length && n.text.length > 20, code).toBe(true);
  });
});

describe("common traps", () => {
  it("the whole list is in every writer's prompt and in the reviewer's", () => {
    for (const system of [PASS_A_SYSTEM, PASS_B_SYSTEM, PASS_C_SYSTEM, PASS_D_SYSTEM, REVIEW_SYSTEM]) {
      for (const t of COMMON_TRAPS) expect(system, t.id).toContain(t.right);
    }
  });
  it("start with the ones the course owner named", () => {
    const ids = COMMON_TRAPS.map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(["ich-bin-gut", "ich-bin-kalt", "bekommen", "tsch-sch", "du-sie", "gute-guten"]));
  });
  it("every pattern really matches its wrong example and not the right one", () => {
    expect(COMMON_TRAPS.find((t) => t.id === "ich-bin-gut")!.detect!.test("Mir geht es gut.")).toBe(false);
    expect(COMMON_TRAPS.find((t) => t.id === "ich-bin-gut")!.detect!.test("Ich bin gut.")).toBe(true);
    expect(COMMON_TRAPS.find((t) => t.id === "age-haben")!.detect!.test("Ich habe 25 Jahre.")).toBe(true);
  });
});

describe("the rules of the generator", () => {
  it("writers are told to list accepted answers, check pronunciation against the spelling, and use tables", () => {
    expect(PASS_A_SYSTEM).toContain("accepted_answers");
    expect(PASS_A_SYSTEM).toContain("spell the word letter by letter");
    expect(PASS_A_SYSTEM).toContain("support tables");
    expect(PASS_D_SYSTEM).toContain("EARLIER sessions");
    expect(PASS_C_SYSTEM).toContain("FRESH items");
  });
  it("the reviewer completes accepted answers and checks every pronunciation claim against the spelling", () => {
    expect(REVIEW_SYSTEM).toContain("accepted_answers");
    expect(REVIEW_SYSTEM).toContain("Pronunciation claims: for EVERY statement");
    expect(REVIEW_SYSTEM).toContain("Tschüs has tsch");
  });

  it("distractors must be clearly false but plausible, for the writers and for the reviewer", () => {
    for (const system of [PASS_A_SYSTEM, PASS_B_SYSTEM, PASS_C_SYSTEM, PASS_D_SYSTEM]) expect(system).toContain("clearly false but plausible");
    expect(REVIEW_SYSTEM).toContain("clearly false but plausible");
    expect(REVIEW_SYSTEM).toContain("Wien ist ein Freund");
    expect(REVIEW_SYSTEM).toContain("also correct");
  });

  it("the model answer must meet its own task: words and sentences", () => {
    expect(PASS_B_SYSTEM).toContain("exactly the number of sentences the task names");
    expect(REVIEW_SYSTEM).toContain("the model answer meets its own task");
  });

  it("the writer is told how to count a model answer, and how to keep the exam fresh", () => {
    expect(PASS_B_SYSTEM).toContain("count before you answer");
    expect(PASS_B_SYSTEM).toContain("A greeting (\"Hallo Lena!\"), a closing");
    expect(PASS_B_SYSTEM).toContain("min_words + 3");
    expect(PASS_C_SYSTEM).toContain("must not reuse any sentence of the lesson's reading text");
    expect(PASS_D_SYSTEM).toContain("never a draft, a placeholder");
  });
});
