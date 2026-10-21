import { describe, expect, it } from "vitest";
import { applyFix, enumerateItems, getAt, setAt, UNIT_SCHEMAS, valueOf } from "./lesson-items.ts";
import { PARTS } from "./lesson-schema.ts";
import { validLesson } from "./test-fixtures.ts";

describe("enumerateItems", () => {
  const lesson = validLesson();
  const items = enumerateItems("Z1", lesson);

  it("lists every unit of the lesson with a stable id, in lesson order", () => {
    expect(items).toHaveLength(93);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    expect(items[0].id).toBe("Z1#goal");
    expect(items.at(-1)!.id).toBe("Z1#closing");
    expect(items.map((i) => i.id)).toEqual(expect.arrayContaining(["Z1#grammar.intro", "Z1#grammar.ex6", "Z1#exercises.19", "Z1#vocabulary.w18", "Z1#vocabulary.p5", "Z1#exam.gv6", "Z1#exam.listening.q2", "Z1#speaking.tandem"]));
  });

  it("every one of the 14 parts has at least one item, and parts come in order", () => {
    const partsInOrder = [...new Set(items.map((i) => i.part))];
    expect(partsInOrder).toEqual([...PARTS]);
  });

  it("every item points at a value that fits its unit's schema", () => {
    for (const item of items) {
      const parsed = UNIT_SCHEMAS[item.unit].safeParse(valueOf(lesson, item));
      expect(parsed.success, item.id).toBe(true);
    }
  });

  it("is generated from the content: more exercises mean more items", () => {
    const more = validLesson();
    more.exercises.items.push({ ...more.exercises.items[0], prompt: "extra ___ x" });
    expect(enumerateItems("Z1", more)).toHaveLength(94);
  });
});

describe("pointers", () => {
  it("get and set without touching the original", () => {
    const lesson = validLesson();
    expect(getAt(lesson, ["vocabulary", "words", 0, "de"])).toBe("Kaffee");
    const changed = setAt(lesson, ["vocabulary", "words", 0, "de"], "Tee2");
    expect(getAt(changed, ["vocabulary", "words", 0, "de"])).toBe("Tee2");
    expect(lesson.vocabulary.words[0].de).toBe("Kaffee");
  });
});

describe("applyFix", () => {
  const lesson = validLesson();
  const item = enumerateItems("Z1", lesson).find((i) => i.id === "Z1#vocabulary.w01")!;

  it("replaces exactly one unit with a valid correction", () => {
    const fixed = { ...lesson.vocabulary.words[0], plural: "die Kaffees (rare)" };
    const out = applyFix(lesson, item, JSON.stringify(fixed))!;
    expect(out.lesson.vocabulary.words[0].plural).toBe("die Kaffees (rare)");
    expect(out.lesson.vocabulary.words[1]).toEqual(lesson.vocabulary.words[1]);
    expect(lesson.vocabulary.words[0].plural).toBe("die Kaffees"); // original untouched
  });

  it("refuses text that is not JSON, and JSON that does not fit the unit (a card with a wrong article, a missing field)", () => {
    expect(applyFix(lesson, item, "not json")).toBeNull();
    expect(applyFix(lesson, item, JSON.stringify({ ...lesson.vocabulary.words[0], article: "le" }))).toBeNull();
    const missing: Record<string, unknown> = { ...lesson.vocabulary.words[0] };
    delete missing.example;
    expect(applyFix(lesson, item, JSON.stringify(missing))).toBeNull();
    expect(applyFix(lesson, item, JSON.stringify({ can_do: "wrong unit" }))).toBeNull();
  });

  it("works for a block unit too (the writing task)", () => {
    const writing = enumerateItems("Z1", lesson).find((i) => i.id === "Z1#writing")!;
    const out = applyFix(lesson, writing, JSON.stringify({ ...lesson.writing, min_words: 35 }))!;
    expect(out.lesson.writing.min_words).toBe(35);
  });
});
