import { describe, expect, it } from "vitest";
import { checkAnswer, describeNote, normalise, words } from "./answer-check.ts";

const typing = { type: "typing" as const, answer: "Ich heiße Jonas.", accepted_answers: ["Mein Name ist Jonas."] };

describe("words / normalise", () => {
  it("drops punctuation but keeps hyphens and apostrophes inside words", () => {
    expect(words("Mir geht's gut, danke!")).toEqual(["Mir", "geht's", "gut", "danke"]);
    expect(words("Meine E-Mail ist … „toll“.")).toEqual(["Meine", "E-Mail", "ist", "toll"]);
    expect(words("Ja – gern")).toEqual(["Ja", "gern"]);
  });
  it("folds case and ß/ss", () => {
    expect(normalise("Ich HEIßE Jonas!")).toBe(normalise("ich heisse jonas"));
  });
});

describe("typing and translation", () => {
  it("accepts the answer and every listed alternative", () => {
    expect(checkAnswer(typing, "Ich heiße Jonas.").matched).toBe("Ich heiße Jonas.");
    expect(checkAnswer(typing, "Mein Name ist Jonas").matched).toBe("Mein Name ist Jonas.");
    expect(checkAnswer(typing, "Mein Name ist Jonas").correct).toBe(true);
  });
  it("ignores case, punctuation and ß/ss, with a gentle note for each slip", () => {
    const r = checkAnswer({ type: "typing", answer: "Gute Nacht!" }, "gute nacht");
    expect(r.correct).toBe(true);
    expect(r.notes.map(describeNote)).toEqual(["Gute is written with a capital G", "Nacht is written with a capital N"]);
    const r2 = checkAnswer(typing, "Ich heisse Jonas");
    expect(r2.correct).toBe(true);
    expect(r2.notes.map(describeNote)).toEqual(["heiße is written with ß"]);
  });
  it("notes a capital where a small letter belongs", () => {
    const r = checkAnswer(typing, "Ich Heiße Jonas");
    expect(r.correct).toBe(true);
    expect(r.notes.map(describeNote)).toEqual(["heiße is written with a small h"]);
  });
  it("gives no note for a perfect answer, and rejects a different answer", () => {
    expect(checkAnswer(typing, "Ich heiße Jonas.").notes).toEqual([]);
    expect(checkAnswer(typing, "Ich bin Jonas.")).toEqual({ correct: false, matched: null, notes: [] });
    expect(checkAnswer(typing, "   ").correct).toBe(false);
  });
});

describe("ordering", () => {
  const order = { type: "ordering" as const, answer: "Jonas kommt aus Deutschland.", accepted_answers: ["Aus Deutschland kommt Jonas."] };
  it("accepts every listed order, ignoring case and punctuation, and gives no notes", () => {
    expect(checkAnswer(order, "aus deutschland kommt jonas").correct).toBe(true);
    expect(checkAnswer(order, "Jonas kommt aus Deutschland").notes).toEqual([]);
    expect(checkAnswer(order, "Deutschland kommt Jonas aus").correct).toBe(false);
  });
});

describe("dictation", () => {
  const dictation = { type: "dictation" as const, answer: "Ich heiße Jonas." };
  it("ignores punctuation and spacing", () => {
    expect(checkAnswer(dictation, "Ich  heiße Jonas").correct).toBe(true);
  });
  it("counts case and ß/ss as errors, and says which", () => {
    const small = checkAnswer({ type: "dictation", answer: "Gute Nacht!" }, "Gute nacht");
    expect(small.correct).toBe(false);
    expect(small.notes.map(describeNote)).toEqual(["Nacht is written with a capital N"]);
    const ss = checkAnswer(dictation, "Ich heisse Jonas.");
    expect(ss.correct).toBe(false);
    expect(ss.notes.map(describeNote)).toEqual(["heiße is written with ß"]);
  });
  it("gives no notes for a different sentence", () => {
    expect(checkAnswer(dictation, "Ich bin Jonas")).toEqual({ correct: false, matched: null, notes: [] });
  });
});

describe("choice questions", () => {
  it("need the exact option", () => {
    expect(checkAnswer({ type: "multiple_choice", answer: "like a long 'ee'" }, "like a long 'ee'").correct).toBe(true);
    expect(checkAnswer({ type: "gap_fill", answer: "bin" }, "Bin").correct).toBe(false);
  });
});
