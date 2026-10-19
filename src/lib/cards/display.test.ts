import { describe, expect, it } from "vitest";
import { theme } from "@/theme";
import { articleColor, articleTone, buildCardView, splitAnswerPrompt } from "./display";
import { makeCard } from "./test-helpers";

const noun = makeCard({ kind: "word", article: "die", de: "Stadt", en: "city", plural: "die Städte", example: "Bielefeld ist eine Stadt.", exampleEn: "Bielefeld is a city.", tip: "-t → die" });
const verb = makeCard({ kind: "word", article: null, de: "heißen", en: "to be called", plural: "ich heiße · du heißt", example: null, exampleEn: null });
const say = makeCard({ kind: "say", article: null, en: "My name is Raghav.", de: "Ich heiße Raghav.", plural: null, example: null, exampleEn: null, tip: "ich → -e" });
const answer = makeCard({ kind: "answer", article: null, en: "Answer (in a café): Was möchten Sie?", de: "Ich möchte einen Tee, bitte.", plural: null, example: null, exampleEn: null, tip: "der → einen" });

describe("article colours", () => {
  it("uses the theme: der blue, die red, das green, none grey", () => {
    expect(articleColor(articleTone("der"))).toBe(theme.article.der);
    expect(articleColor(articleTone("die"))).toBe("#C3303A");
    expect(articleColor(articleTone("das"))).toBe("#1E8A4C");
    expect(articleColor(articleTone(null))).toBe(theme.article.none);
  });
});

describe("splitAnswerPrompt", () => {
  it("removes the Answer prefix and keeps the situation as context", () => {
    expect(splitAnswerPrompt("Answer: Wie geht's?")).toEqual({ question: "Wie geht's?", context: null });
    expect(splitAnswerPrompt("Answer (in a café): Was möchten Sie?")).toEqual({ question: "Was möchten Sie?", context: "in a café" });
    expect(splitAnswerPrompt("No prefix here")).toEqual({ question: "No prefix here", context: null });
  });
});

describe("word cards", () => {
  it("English → German: English on the front, coloured article + word, forms, meaning, example and tip on the back", () => {
    const v = buildCardView(noun, "en-de");
    expect(v.front).toEqual({ label: null, text: "city", article: null, context: null });
    expect(v.back).toEqual({
      article: "die",
      articleText: "die",
      german: "Stadt",
      forms: "die Städte",
      english: "city",
      example: "Bielefeld ist eine Stadt.",
      exampleEn: "Bielefeld is a city.",
      tip: "-t → die",
    });
    expect(v.speak).toEqual({ word: "die Stadt", sentence: "Bielefeld ist eine Stadt." });
  });

  it("German → English: coloured article + word on the front, same full back", () => {
    const v = buildCardView(noun, "de-en");
    expect(v.front).toEqual({ label: null, text: "Stadt", article: "die", context: null });
    expect(v.back.english).toBe("city");
  });

  it("words without an article are grey and are spoken bare", () => {
    const v = buildCardView(verb, "en-de");
    expect(v.back).toMatchObject({ article: "none", articleText: null, forms: "ich heiße · du heißt", example: null });
    expect(v.speak).toEqual({ word: "heißen", sentence: null });
  });
});

describe("speaking cards", () => {
  it("say: 'Say it in German' with the English prompt; reversed it becomes 'Say it in English'", () => {
    expect(buildCardView(say, "en-de").front).toEqual({ label: "sayInGerman", text: "My name is Raghav.", article: null, context: null });
    expect(buildCardView(say, "de-en").front).toEqual({ label: "sayInEnglish", text: "Ich heiße Raghav.", article: null, context: null });
    const v = buildCardView(say, "en-de");
    expect(v.back).toMatchObject({ article: "none", german: "Ich heiße Raghav.", english: "My name is Raghav.", tip: "ich → -e" });
    expect(v.speak).toEqual({ word: null, sentence: "Ich heiße Raghav." });
  });

  it("answer: 'Answer out loud' with the German question; never reverses", () => {
    for (const dir of ["en-de", "de-en"] as const) {
      const v = buildCardView(answer, dir);
      expect(v.direction).toBe("en-de");
      expect(v.front).toEqual({ label: "answerOutLoud", text: "Was möchten Sie?", article: null, context: "in a café" });
      expect(v.back).toMatchObject({ german: "Ich möchte einen Tee, bitte.", english: null });
      expect(v.speak.sentence).toBe("Ich möchte einen Tee, bitte.");
    }
  });
});
