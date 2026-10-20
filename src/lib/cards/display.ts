import { articleToken, type Article } from "@/theme";
import type { Direction } from "./queue";
import type { SnapshotCard } from "./schema";

/** Colour key for a card's article; words without one (verbs, adjectives, sentences) are grey. */
export type ArticleTone = Article;

export const articleTone = (article: SnapshotCard["article"]): ArticleTone => article ?? "none";
/** CSS colour for an article tone: the design token (so it follows light and dark mode). */
export const articleColor = (tone: ArticleTone) => `var(--${articleToken(tone)})`;

/** Which prompt label sits above the front of the card (messages: Cards.label.*). */
export type FrontLabel = "sayInGerman" | "answerOutLoud" | "sayInEnglish";

export interface FrontView {
  label: FrontLabel | null;
  /** Shown in a neutral colour. For German-first word cards this is the bare word and `article` is set. */
  text: string;
  article: ArticleTone | null;
  /** Situation hint from an answer card, e.g. "in a café". */
  context: string | null;
}

export interface BackView {
  /** Coloured article, null for cards without one. */
  article: ArticleTone;
  articleText: string | null;
  /** The German word or sentence. */
  german: string;
  /** Plural or verb-forms line. */
  forms: string | null;
  /** English meaning; null on answer cards, whose front already shows the (German) question. */
  english: string | null;
  example: string | null;
  exampleEn: string | null;
  tip: string | null;
}

export interface SpeakView {
  /** "der Hund" for nouns, the bare word otherwise. Null for sentence cards. */
  word: string | null;
  /** The example sentence, or the whole German line of a speaking card. */
  sentence: string | null;
}

export interface CardView {
  front: FrontView;
  /** German on the front that can be played (German-first cards and answer questions); null when the front is English. */
  frontSpeak: SpeakView | null;
  back: BackView;
  speak: SpeakView;
  /** Direction actually used (answer cards never reverse). */
  direction: Direction;
}

const ANSWER_PREFIX = /^Answer(?:\s*\(([^)]*)\))?\s*:\s*/i;

/** "Answer (in a café): Was möchten Sie?" -> { question: "Was möchten Sie?", context: "in a café" }. */
export function splitAnswerPrompt(en: string): { question: string; context: string | null } {
  const m = ANSWER_PREFIX.exec(en);
  if (!m) return { question: en, context: null };
  return { question: en.slice(m[0].length).trim() || en, context: m[1]?.trim() || null };
}

export function buildCardView(card: SnapshotCard, direction: Direction): CardView {
  const tone = articleTone(card.article);
  const back: BackView = {
    article: tone,
    articleText: card.article,
    german: card.de,
    forms: card.plural,
    english: card.kind === "answer" ? null : card.en,
    example: card.example,
    exampleEn: card.exampleEn,
    tip: card.tip,
  };

  if (card.kind === "word") {
    const speak: SpeakView = { word: card.article ? `${card.article} ${card.de}` : card.de, sentence: card.example };
    return {
      direction,
      back,
      speak,
      frontSpeak: direction === "de-en" ? { word: speak.word, sentence: null } : null,
      front:
        direction === "en-de"
          ? { label: null, text: card.en, article: null, context: null }
          : { label: null, text: card.de, article: tone, context: null },
    };
  }

  const speak: SpeakView = { word: null, sentence: card.de };

  if (card.kind === "answer") {
    const { question, context } = splitAnswerPrompt(card.en);
    // The question is German and the answer is spoken: reversing that has no meaning, so direction never applies.
    return {
      direction: "en-de",
      speak,
      frontSpeak: { word: null, sentence: question },
      back,
      front: { label: "answerOutLoud", text: question, article: null, context },
    };
  }

  return {
    direction,
    speak,
    frontSpeak: direction === "de-en" ? { word: null, sentence: card.de } : null,
    back,
    front:
      direction === "en-de"
        ? { label: "sayInGerman", text: card.en, article: null, context: null }
        : { label: "sayInEnglish", text: card.de, article: null, context: null },
  };
}
