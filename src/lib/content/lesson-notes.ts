// Requirements from the course owner for one specific lesson, on top of the general standard. They are added to the prompts of the passes
// they name and to the review prompt, so the writer must meet them and the reviewer checks them. Add a note here whenever a lesson needs
// something the general rules do not say; delete it when it has become a general rule.

export type NotePass = "A" | "B" | "C" | "D";
export interface LessonNote {
  /** The generation passes whose prompt carries the note (the review always sees every note of the lesson). */
  passes: readonly NotePass[];
  text: string;
}

export const LESSON_NOTES: Record<string, readonly LessonNote[]> = {
  Z1: [
    {
      passes: ["A"],
      text: "The grammar part contains one support table of the whole German alphabet with the German letter names, in alphabet order, one row per letter, columns Letter | Name (how it is said). The names are exactly: A ah, B beh, C tseh, D deh, E eh, F eff, G geh, H hah, I ih, J jott, K kah, L ell, M emm, N enn, O oh, P peh, Q kuh, R err, S ess, T teh, U uh, V fau, W veh, X iks, Y üpsilon, Z tsett. After Z come the rows Ä, Ö, Ü (name each as the letter plus “Umlaut”, for example “ah-Umlaut”) and ß (Eszett).",
    },
    { passes: ["A"], text: "One of the grammar examples shows how to spell a name aloud with these letter names, for example Jonas = jott – oh – enn – ah – ess, with the English translation." },
    {
      passes: ["A", "B", "C", "D"],
      text: "“Tschüs” is spelled with tsch, which sounds like English “ch” as in “church”; it is NOT “sch” (English “sh”). Keep tsch and sch clearly apart everywhere (pronunciation part, tips, hints, exercises), and say “sch” only for words that really contain sch, such as Schule.",
    },
    { passes: ["A"], text: "The vocabulary contains the verb heißen, and its tip is exactly: du heißt = heiß + t; the ß stays, no extra s." },
    {
      passes: ["A"],
      text: "Formal address: this lesson has 7 useful phrases (not 5). Besides the informal “Wie heißt du?” they include the formal “Wie heißen Sie?” and “Wie ist Ihr Name?” (tip: Sie is for adults you do not know, with a capital S).",
    },
    {
      passes: ["A"],
      text: "Exactly one of the multiple_choice exercises contrasts du and Sie: a short situation in the prompt (for example you meet your teacher, or a child at a bus stop) and the learner picks the right question from “Wie heißt du?” and “Wie heißen Sie?”. The situation must make one option clearly right.",
    },
  ],
  Z2: [
    {
      passes: ["A", "B", "C", "D"],
      text: "Never teach “Ich bin gut” for how you feel. Well-being is “Mir geht es gut.” / “Mir geht's gut.” (question: “Wie geht es dir?”). Feelings and states with sein are fine: “Ich bin müde / hungrig / froh”. In the vocabulary, the card for gut has an example with “Mir geht es gut.” (English: I am fine). Do not use “Ich bin gut” for well-being in any example, exercise, model answer, rubric, mission or exam item; a trap may show it as the wrong sentence.",
    },
    {
      passes: ["B"],
      text: "Writing task: the task asks for 3 to 5 short sentences and the model answer has 3 to 5 natural sentences (no “Ich bin eine Frau”, and “Ich komme aus” appears once, for example “Ich komme aus Hamburg in Deutschland.”) with at least 80% of min_words words in total. The rubric and must_include agree with it and do not promote “Ich bin gut”.",
    },
  ],
  Z3: [
    {
      passes: ["B"],
      text: "The Tandem scenario stays inside what this lesson teaches: numbers 0 to 100, phone numbers, age, names and spelling. No dates, birthdays, ordinal numbers, months or e-mail addresses in topics or target phrases (they are taught later).",
    },
  ],
};

export const notesFor = (code: string, pass?: NotePass): string[] => (LESSON_NOTES[code] ?? []).filter((n) => !pass || n.passes.includes(pass)).map((n) => n.text);
