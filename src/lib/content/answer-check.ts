import type { Question } from "./lesson-schema.ts";

// How a learner's answer to a question is checked (the lesson player in slice 4 uses this; the generator's lint uses the same normalisation).
// Relative imports only: the scripts run this file with plain Node.
//
//   typing / translation  Case, punctuation and ß/ss are ignored, so "ich heisse jonas" is right for "Ich heiße Jonas." The answer is still
//                         marked right, with a gentle note for each spelling slip ("Nacht is written with a capital N").
//   ordering              The same normalisation (the learner arranges given words), no notes.
//   dictation             Case and ß/ss count as errors (spelling is the point). Punctuation and spaces are ignored.
//   choice questions      The chosen option must be the answer.
//
// `answer` and every entry of `accepted_answers` are equally right.

export type AnswerNote =
  | { kind: "capital"; word: string; letter: string }
  | { kind: "small"; word: string; letter: string }
  | { kind: "eszett"; word: string };

export interface AnswerResult {
  correct: boolean;
  /** The listed answer the learner's answer matched (as written in the lesson), or null. */
  matched: string | null;
  /** Spelling slips: a gentle correction on a right typing answer, the reason for a wrong dictation. */
  notes: AnswerNote[];
}

type Checkable = Pick<Question, "type" | "answer"> & { accepted_answers?: string[] };

const PUNCTUATION = /[.,!?;:"„“”‚‘«»…()]/g;

/** The words of a text as written, without punctuation. Hyphens inside words and apostrophes stay (E-Mail, geht's). */
export function words(text: string): string[] {
  return text
    .normalize("NFC")
    .replace(/’/g, "'")
    .replace(/\s[-–—]+\s/g, " ")
    .replace(PUNCTUATION, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Case and ß/ss do not matter once folded. */
export const fold = (word: string) => word.toLocaleLowerCase("de").replace(/ß|ẞ/g, "ss");

/** One normalised string for comparing texts: folded words separated by single spaces. */
export const normalise = (text: string) => words(text).map(fold).join(" ");

const sameFolded = (a: string[], b: string[]) => a.length === b.length && a.every((w, i) => fold(w) === fold(b[i]));
const sameExact = (a: string[], b: string[]) => a.length === b.length && a.every((w, i) => w === b[i]);

function notesFor(given: string[], listed: string[]): AnswerNote[] {
  const notes: AnswerNote[] = [];
  listed.forEach((word, i) => {
    const g = given[i];
    if (g === word) return;
    const [g0, w0] = [g[0], word[0]];
    if (g0 !== w0 && fold(g0) === fold(w0)) {
      notes.push(w0 === w0.toLocaleUpperCase("de") ? { kind: "capital", word, letter: w0 } : { kind: "small", word, letter: w0 });
    }
    if (word.includes("ß") && !g.includes("ß")) notes.push({ kind: "eszett", word });
  });
  return notes;
}

export function checkAnswer(q: Checkable, given: string): AnswerResult {
  const listed = [q.answer, ...(q.accepted_answers ?? [])];
  const answer = given.trim();

  if (q.type === "multiple_choice" || q.type === "gap_fill") {
    const matched = listed.find((a) => a === answer) ?? null;
    return { correct: matched !== null, matched, notes: [] };
  }

  const typed = words(answer);
  if (typed.length === 0) return { correct: false, matched: null, notes: [] };

  if (q.type === "dictation") {
    const exact = listed.find((a) => sameExact(typed, words(a)));
    if (exact) return { correct: true, matched: exact, notes: [] };
    const near = listed.find((a) => sameFolded(typed, words(a)));
    return { correct: false, matched: null, notes: near ? notesFor(typed, words(near)) : [] };
  }

  const matched = listed.find((a) => sameFolded(typed, words(a))) ?? null;
  if (!matched) return { correct: false, matched: null, notes: [] };
  return { correct: true, matched, notes: q.type === "typing" ? notesFor(typed, words(matched)) : [] };
}

/** English wording of a note until the i18n layer takes over (UI strings go through next-intl). */
export function describeNote(note: AnswerNote): string {
  switch (note.kind) {
    case "capital":
      return `${note.word} is written with a capital ${note.letter}`;
    case "small":
      return `${note.word} is written with a small ${note.letter}`;
    case "eszett":
      return `${note.word} is written with ß`;
  }
}
