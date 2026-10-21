import { describe, expect, it } from "vitest";
import { enumerateItems, UNIT_SCHEMAS, valueOf, type UnitName } from "./lesson-items.ts";
import { PARTS } from "./lesson-schema.ts";
import { lessonToMarkdown, PART_TITLES, unitLines } from "./lesson-text.ts";
import { validLesson } from "./test-fixtures.ts";

describe("unitLines", () => {
  const lesson = validLesson();
  it("has a readable form for every kind of unit that occurs in a lesson", () => {
    const kinds = new Set(enumerateItems("Z1", lesson).map((i) => i.unit));
    expect([...kinds].sort()).toEqual(Object.keys(UNIT_SCHEMAS).sort());
    for (const item of enumerateItems("Z1", lesson)) {
      const lines = unitLines(item.unit as UnitName, valueOf(lesson, item) as Record<string, unknown>);
      expect(lines.length, item.id).toBeGreaterThan(0);
      expect(lines.join("\n"), item.id).not.toMatch(/undefined|\[object/);
    }
  });

  it("a word card reads like the app's card: article, word, plural, meaning, example", () => {
    const text = unitLines("card", lesson.vocabulary.words[0]).join("\n");
    expect(text).toContain("der Kaffee");
    expect(text).toContain("die Kaffees");
    expect(text).toContain("coffee");
    expect(text).toContain("Das ist Kaffee.");
  });
});

describe("lessonToMarkdown", () => {
  const meta = { code: "Z1", phase: "zero", theme: "Begrüßung & Verabschiedung", grammar: "Alphabet" };
  const md = lessonToMarkdown(meta, validLesson());

  it("has a heading for each of the 14 parts, numbered 0 to 13, in order", () => {
    const headings = md.split("\n").filter((l) => l.startsWith("## "));
    expect(headings).toEqual(PARTS.map((p, i) => `## ${i}. ${PART_TITLES[p]}`));
    expect(headings).toHaveLength(14);
  });

  it("contains the German and the English text so it can be proof-read", () => {
    expect(md).toContain("# Z1 · Begrüßung & Verabschiedung");
    expect(md).toContain("Ich trinke Kaffee.");
    expect(md).toContain("Anna: Hallo Jonas, was trinkst du heute im Café?");
    expect(md).toContain("I can order a drink");
    expect(md).toContain("`Z1#exam.speaking`");
  });

  it("marks fixed and needs-human items next to the item, and says nothing about ok ones", () => {
    const marks = new Map([
      ["Z1#vocabulary.w01", { status: "fixed" as const, reason: "plural corrected" }],
      ["Z1#reading.q2", { status: "needs-human" as const, reason: "two answers possible" }],
      ["Z1#goal", { status: "ok" as const, reason: "fine" }],
    ]);
    const marked = lessonToMarkdown(meta, validLesson(), marks);
    expect(marked).toContain("⟵ FIXED: plural corrected");
    expect(marked).toContain("⟵ NEEDS HUMAN: two answers possible");
    expect(marked).not.toContain("fine");
  });
});
