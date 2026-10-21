import { describe, expect, it } from "vitest";
import { errorIds, lintLesson } from "./lint.ts";
import { cardId, QUESTIONS_PER_LESSON, questionId } from "./schema.ts";
import { validContent } from "./test-fixtures.ts";

const rules = (code: string, content = validContent()) => lintLesson(code, content).map((i) => `${i.id}:${i.rule}`);

describe("lintLesson", () => {
  it("a well-formed lesson has no errors", () => {
    expect(lintLesson("Z9", validContent()).filter((i) => i.level === "error")).toEqual([]);
    expect(validContent().questions).toHaveLength(QUESTIONS_PER_LESSON);
  });

  it("wrong number of cards or questions is a lesson-level error", () => {
    const content = validContent();
    content.cards.pop();
    content.questions.pop();
    expect(rules("Z9", content)).toEqual(expect.arrayContaining(["lesson:card-count", "lesson:question-count"]));
  });

  it("the same word twice is flagged on the second", () => {
    const content = validContent();
    content.cards[3] = { ...content.cards[3], de: "kaffee" };
    expect(rules("Z9", content)).toContain(`${cardId("Z9", 3)}:duplicate-word`);
  });

  describe("cards", () => {
    const withCard = (over: object) => {
      const content = validContent();
      content.cards[0] = { ...content.cards[0], ...over };
      return rules("Z9", content).filter((r) => r.startsWith(cardId("Z9", 0)));
    };
    it("an article left inside the German word", () => expect(withCard({ de: "der Kaffee" })).toContain("Z9#c01:article-in-de"));
    it("a noun must be capitalised", () => expect(withCard({ de: "kaffee" })).toContain("Z9#c01:noun-capital"));
    it("a noun needs a plural line, written like “die Kaffees”", () => {
      expect(withCard({ plural: null })).toContain("Z9#c01:plural-missing");
      expect(withCard({ plural: "Kaffees" })).toContain("Z9#c01:plural-format");
      expect(withCard({ plural: "—" })).not.toContain("Z9#c01:plural-format");
    });
    it("a verb needs a forms line", () => {
      expect(withCard({ article: null, en: "to drink", de: "trinken", plural: null, example: "Ich trinke Tee." })).toContain("Z9#c01:verb-forms");
      expect(withCard({ article: null, en: "to drink", de: "trinken", plural: "ich trinke · du trinkst · er trinkt", example: "Ich trinke Tee." })).not.toContain("Z9#c01:verb-forms");
    });
    it("the example should contain the word and end with punctuation", () => {
      expect(withCard({ example: "Ich trinke Tee." })).toContain("Z9#c01:example-word");
      expect(withCard({ example: "Ich trinke einen Kaffee" })).toContain("Z9#c01:example-punctuation");
    });
    it("accepts an inflected verb in the example", () => {
      const out = withCard({ article: null, en: "to come", de: "kommen", plural: "ich komme · du kommst · er kommt", example: "Ich komme aus Indien." });
      expect(out).not.toContain("Z9#c01:example-word");
    });
  });

  describe("questions", () => {
    const withQuestion = (index: number, over: object) => {
      const content = validContent();
      content.questions[index] = { ...content.questions[index], ...over };
      return lintLesson("Z9", content).filter((i) => i.id === questionId("Z9", index));
    };
    const ruleNames = (list: { rule: string }[]) => list.map((i) => i.rule);

    it("multiple choice: 2 to 4 distinct wrong options, none equal to the answer", () => {
      expect(ruleNames(withQuestion(0, { distractors: ["a"] }))).toContain("mc-options");
      expect(ruleNames(withQuestion(0, { distractors: ["a", "A", "b"] }))).toContain("distractors-distinct");
      expect(ruleNames(withQuestion(0, { distractors: ["coffee", "b", "c"] }))).toContain("distractor-is-answer");
    });
    it("gap fill must contain ___ and have wrong options", () => {
      expect(ruleNames(withQuestion(6, { prompt: "Ich trinke Kaffee." }))).toContain("gap-missing");
      expect(ruleNames(withQuestion(6, { distractors: [] }))).toContain("gap-options");
    });
    it("ordering: the scrambled words must be exactly the words of the answer", () => {
      expect(withQuestion(9, {})).toEqual([]);
      expect(ruleNames(withQuestion(9, { prompt: "Kaffee / ich" }))).toContain("ordering-words");
      expect(ruleNames(withQuestion(9, { prompt: "Kaffee / ich / trinke / gern" }))).toContain("ordering-words");
      expect(ruleNames(withQuestion(9, { answer: "Ich trinke Tee." }))).toContain("ordering-words");
    });
    it("article questions are answered with an article, wrong options are the other articles", () => {
      expect(ruleNames(withQuestion(3, { answer: "Kaffee" }))).toContain("article-answer");
      expect(ruleNames(withQuestion(3, { distractors: ["die", "Tee"] }))).toContain("article-options");
    });
  });

  it("errorIds lists only items with errors, not warnings", () => {
    const content = validContent();
    content.cards[1] = { ...content.cards[1], example: "Ich trinke Tee" }; // warning only
    content.cards[2] = { ...content.cards[2], de: "brot" }; // error
    const ids = errorIds(lintLesson("Z9", content));
    expect(ids.has("Z9#c03")).toBe(true);
    expect(ids.has("Z9#c02")).toBe(false);
  });
});
