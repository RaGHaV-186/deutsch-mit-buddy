import { describe, expect, it } from "vitest";
import { COUNTS, EXERCISES_PER_LESSON, LEVEL_PROFILES, PARTS, PASS_A_PARTS, PASS_A_JSON_SCHEMA, PASS_B_JSON_SCHEMA, PASS_B_PARTS, PASS_C_JSON_SCHEMA, PASS_C_PARTS, REVIEW_JSON_SCHEMA, lessonSchema, passASchema, passBSchema, passCSchema, reviewResultSchema, toApiSchema, wireToDomain } from "./lesson-schema.ts";
import { z } from "zod";
import { validLesson, validPassA, validPassB, validPassC } from "./test-fixtures.ts";

describe("the 14 parts", () => {
  it("are exactly the lesson standard, in order, and split between passes A, B and C", () => {
    expect(PARTS).toEqual(["goal", "warmup", "grammar", "exercises", "vocabulary", "pronunciation", "reading", "listening", "writing", "speaking", "culture", "mission", "exam", "closing"]);
    expect(PARTS).toHaveLength(14);
    expect([...PASS_A_PARTS, ...PASS_B_PARTS, ...PASS_C_PARTS]).toEqual(PARTS);
    expect(PASS_B_PARTS).toEqual(["reading", "listening", "writing", "speaking"]);
    expect(PASS_C_PARTS).toEqual(["culture", "mission", "exam", "closing"]);
  });

  it("a lesson is valid only when every part is present", () => {
    expect(lessonSchema.safeParse(validLesson()).success).toBe(true);
    for (const part of PARTS) {
      const broken: Record<string, unknown> = { ...validLesson() };
      delete broken[part];
      expect(lessonSchema.safeParse(broken).success, `without ${part}`).toBe(false);
    }
    expect(Object.keys(lessonSchema.shape)).toEqual([...PARTS]);
  });

  it("passes A, B and C validate on their own, and not as each other", () => {
    expect(passASchema.safeParse(validPassA()).success).toBe(true);
    expect(passBSchema.safeParse(validPassB()).success).toBe(true);
    expect(passCSchema.safeParse(validPassC()).success).toBe(true);
    expect(passASchema.safeParse(validPassB()).success).toBe(false);
    expect(passBSchema.safeParse(validPassC()).success).toBe(false);
  });

  it("rejects wrong shapes inside a part", () => {
    const bad = validLesson();
    (bad.vocabulary.words[0] as { article: string }).article = "le";
    expect(lessonSchema.safeParse(bad).success).toBe(false);
    const empty = validLesson();
    empty.goal.can_do = "";
    expect(lessonSchema.safeParse(empty).success).toBe(false);
    const type = validLesson();
    (type.exercises.items[0] as { type: string }).type = "essay";
    expect(lessonSchema.safeParse(type).success).toBe(false);
  });

  it("the standard's counts", () => {
    expect(EXERCISES_PER_LESSON).toBe(19);
    expect(COUNTS.exercises).toEqual({ gap_fill: 6, multiple_choice: 4, ordering: 3, typing: 3, dictation: 3 });
    expect(COUNTS.wordsCore + COUNTS.wordsBonus).toBe(18);
    expect(COUNTS.phrases).toBe(5);
  });
});

describe("level profiles: the instruction language grows more German", () => {
  it("every phase has a profile, and the German share and task sizes only go up", () => {
    const order = ["zero", "A1", "A2", "B1", "B2", "C1"] as const;
    const mins = order.map((p) => LEVEL_PROFILES[p].germanShare[0]);
    expect(mins).toEqual([...mins].sort((a, b) => a - b));
    expect(LEVEL_PROFILES.zero.instructionLanguage).toMatch(/English only/);
    expect(LEVEL_PROFILES.B2.instructionLanguage).toBe("German only");
    expect(LEVEL_PROFILES.C1.instructionLanguage).toBe("German only");
    expect(LEVEL_PROFILES.exam.cefr).toBe("B1");
    const reading = order.map((p) => LEVEL_PROFILES[p].readingWords[1]);
    expect(reading).toEqual([...reading].sort((a, b) => a - b));
    expect(LEVEL_PROFILES.A1.writingKind).toMatch(/message/);
    expect(LEVEL_PROFILES.B1.writingKind).toMatch(/email|opinion/);
    expect(LEVEL_PROFILES.B2.writingKind).toMatch(/argument|formal letter/);
    expect(LEVEL_PROFILES.C1.writingKind).toMatch(/essay|presentation/);
  });
});

describe("JSON Schemas sent to the API", () => {
  const walk = (node: unknown, visit: (n: Record<string, unknown>) => void) => {
    if (Array.isArray(node)) node.forEach((n) => walk(n, visit));
    else if (node && typeof node === "object") {
      visit(node as Record<string, unknown>);
      Object.values(node).forEach((n) => walk(n, visit));
    }
  };

  for (const [name, schema] of [["pass A", PASS_A_JSON_SCHEMA], ["pass B", PASS_B_JSON_SCHEMA], ["pass C", PASS_C_JSON_SCHEMA], ["review", REVIEW_JSON_SCHEMA]] as const) {
    it(`${name}: only keywords the API accepts, every object closed and fully required, no $ref`, () => {
      const forbidden = ["minLength", "maxLength", "minItems", "maxItems", "minimum", "maximum", "pattern", "format", "$ref", "$schema", "default"];
      walk(schema, (n) => {
        for (const key of forbidden) expect(n, `${name} contains ${key}`).not.toHaveProperty(key);
        if (n.type === "object" && n.properties) {
          expect(n.additionalProperties).toBe(false);
          expect(n.required).toEqual(Object.keys(n.properties as object));
        }
      });
    });
  }

  it("each pass asks for exactly its own parts", () => {
    expect(Object.keys((PASS_A_JSON_SCHEMA as { properties: object }).properties)).toEqual([...PASS_A_PARTS]);
    expect(Object.keys((PASS_B_JSON_SCHEMA as { properties: object }).properties)).toEqual([...PASS_B_PARTS]);
    expect(Object.keys((PASS_C_JSON_SCHEMA as { properties: object }).properties)).toEqual([...PASS_C_PARTS]);
  });

  it("generation schemas have no null unions (the API refused a grammar that was too large): 'nothing' is an empty string, or none for an article", () => {
    for (const schema of [PASS_A_JSON_SCHEMA, PASS_B_JSON_SCHEMA, PASS_C_JSON_SCHEMA]) expect(JSON.stringify(schema)).not.toContain('"null"');
    const words = (PASS_A_JSON_SCHEMA as { properties: { vocabulary: { properties: { words: { items: { properties: Record<string, unknown> } } } } } }).properties.vocabulary.properties.words.items.properties;
    expect(words.article).toEqual({ type: "string", enum: ["der", "die", "das", "none"] });
    expect(words.tip).toEqual({ type: "string" });
  });

  it("every generation schema is small enough for the API's grammar compiler (each pass was probed with a real request; the whole lesson in one schema was refused)", () => {
    expect(JSON.stringify(PASS_A_JSON_SCHEMA).length).toBeLessThan(4000);
    expect(JSON.stringify(PASS_B_JSON_SCHEMA).length).toBeLessThan(4000);
    expect(JSON.stringify(PASS_C_JSON_SCHEMA).length).toBeLessThan(4500);
  });

  it("the review schema keeps its null union (it was accepted as it is)", () => {
    expect(JSON.stringify(REVIEW_JSON_SCHEMA)).toContain('"null"');
  });

  it("a normal schema still expresses nullable fields as anyOf with null", () => {
    const words = (toApiSchema(passASchema) as { properties: { vocabulary: { properties: { words: { items: { properties: Record<string, { anyOf: unknown[] }> } } } } } }).properties.vocabulary.properties.words.items.properties;
    expect(words.article.anyOf).toEqual([{ type: "string", enum: ["der", "die", "das"] }, { type: "null" }]);
    expect(words.tip.anyOf).toContainEqual({ type: "null" });
  });

  it("toApiSchema strips limits but keeps structure", () => {
    const s = toApiSchema(z.object({ a: z.string().min(2).max(5), b: z.array(z.string()).min(1).max(3), c: z.number().int().min(1) }));
    expect(JSON.stringify(s)).not.toMatch(/minLength|maxLength|minItems|maxItems|minimum/);
    expect((s as { properties: { b: { type: string } } }).properties.b.type).toBe("array");
  });

  it("the review answer carries a correction as a JSON string, and a status from the three verdicts", () => {
    expect(reviewResultSchema.safeParse({ verdicts: [{ id: "Z1#goal", status: "fixed", reason: "x", fixed_json: '{"can_do":"I can."}' }] }).success).toBe(true);
    expect(reviewResultSchema.safeParse({ verdicts: [{ id: "Z1#goal", status: "maybe", reason: "x", fixed_json: null }] }).success).toBe(false);
  });
});

describe("wireToDomain: the model's plain strings become the lesson's nulls", () => {
  it("empty string or none becomes null for the nullable fields, and dialogue lines' en too", () => {
    const wire = {
      words: [{ article: "none", plural: "", tip: "  ", de: "gehen", en: "to go" }],
      script: [{ speaker: "Anna", de: "Hallo", en: "" }, { speaker: "Jonas", de: "Hi", en: "Hi" }],
      mission: { safety_note: "" },
      writing: { target_hint: "" },
      example: { de: "x", en: "y", note: "" },
    };
    expect(wireToDomain(wire)).toEqual({
      words: [{ article: null, plural: null, tip: null, de: "gehen", en: "to go" }],
      script: [{ speaker: "Anna", de: "Hallo", en: null }, { speaker: "Jonas", de: "Hi", en: "Hi" }],
      mission: { safety_note: null },
      writing: { target_hint: null },
      example: { de: "x", en: "y", note: null },
    });
  });

  it("keeps real values, and an English meaning of a card is never turned into null", () => {
    const out = wireToDomain({ article: "der", plural: "die Namen", de: "Name", en: "" }) as Record<string, unknown>;
    expect(out).toEqual({ article: "der", plural: "die Namen", de: "Name", en: "" });
  });

  it("a plain-string pass A round-trips through the lesson schema", () => {
    const wire = JSON.parse(JSON.stringify(validPassA()).replaceAll("null", '""').replace(/"article":"(?!der|die|das)[^"]*"/g, '"article":"none"'));
    const back = passASchema.parse(wireToDomain(wire));
    expect(back).toEqual(passASchema.parse(validPassA())); // (the schema trims text, so compare with the parsed original)
  });
});
