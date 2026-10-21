// Mistakes that learners (and language models) make over and over. This list goes to the writer (Sonnet) and the reviewer (Opus) of every
// lesson, so nobody teaches them wrong and a lesson can use the relevant ones as its "common traps". Extend it whenever a review finds a new one:
// add an entry, nothing else needs to change. `detect` (optional) is a pattern the free lint looks for in a lesson's texts: a hit is only a
// hint for the reviewer (the same text is fine inside a trap that explains why it is wrong).

export interface CommonTrap {
  id: string;
  /** What the learner says or assumes. */
  wrong: string;
  /** What is right. */
  right: string;
  /** The rule behind it, in one or two sentences. */
  why: string;
  /** The lesson topics it belongs to, for the human reader. */
  topic: string;
  detect?: RegExp;
}

export const COMMON_TRAPS: readonly CommonTrap[] = [
  {
    id: "ich-bin-gut",
    wrong: "Ich bin gut. (for how you feel)",
    right: "Mir geht es gut. / Mir geht's gut. (also: Gut, danke.)",
    why: "“Ich bin gut” means “I am good (at something / a good person)”, not “I am fine”. German asks and answers about well-being with “Wie geht es dir? Mir geht es gut.”; “Ich bin müde / hungrig / froh” (a state with sein) is fine.",
    topic: "introductions, feelings, small talk",
    detect: /\bich bin gut\b/i,
  },
  {
    id: "ich-bin-kalt",
    wrong: "Ich bin kalt. / Ich bin warm. / Ich bin heiß.",
    right: "Mir ist kalt. / Mir ist warm. / Mir ist heiß.",
    why: "“Ich bin kalt” says that you are a cold person (or dead). Feeling hot or cold uses “Mir ist …” (dative).",
    topic: "weather, body, feelings",
    detect: /\bich bin (kalt|warm|heiß|heiss)\b/i,
  },
  {
    id: "ich-bin-hunger",
    wrong: "Ich bin Hunger. / Ich bin Durst.",
    right: "Ich habe Hunger. / Ich habe Durst.",
    why: "Hunger and thirst are nouns you “have” in German, not states you “are”.",
    topic: "food and drink, haben",
    detect: /\bich bin (hunger|durst)\b/i,
  },
  {
    id: "age-haben",
    wrong: "Ich habe 25 Jahre.",
    right: "Ich bin 25 (Jahre alt).",
    why: "Age uses sein, not haben (unlike in Spanish or French).",
    topic: "numbers, age",
    detect: /\bich habe \d+ jahre\b/i,
  },
  {
    id: "bekommen",
    wrong: "Ich bekomme Arzt. (meaning “I become a doctor”)",
    right: "Ich werde Arzt. / Ich bekomme ein Geschenk.",
    why: "“bekommen” means to get or receive. “to become” is “werden”. Never translate “become” with “bekommen”.",
    topic: "werden, bekommen, false friends",
    detect: /\bbekomm\w* (arzt|ärztin|lehrer|lehrerin|müde)\b/i,
  },
  {
    id: "tsch-sch",
    wrong: "“Tschüs” and “Deutsch” have the sound “sch” (English “sh”).",
    right: "tsch = English “ch” as in “church” (Tschüs, Deutsch, tschechisch). sch = English “sh” (Schule, schön).",
    why: "Spell the word letter by letter before you say how it sounds: Tschüs = t + sch + ü + s, said “chüs”, not “shüs”.",
    topic: "pronunciation, alphabet",
  },
  {
    id: "du-sie",
    wrong: "Using du with a stranger, a teacher or at work; or writing sie (small s) for the formal “you”.",
    right: "du for friends, family, children and fellow students; Sie (capital S, verb as with “they”) for adults you do not know well, at work and in shops. “Wie heißt du?” / “Wie heißen Sie?”; “Wie ist dein Name?” / “Wie ist Ihr Name?”",
    why: "The formal Sie always has a capital S and takes the same verb form as “sie” (they): Sie heißen, Sie sind. When in doubt, use Sie first.",
    topic: "introductions, greetings, politeness",
  },
  {
    id: "gute-guten",
    wrong: "Guten Nacht! / Gute Morgen! / Gute Tag!",
    right: "Guten Morgen! Guten Tag! Guten Abend! but Gute Nacht!",
    why: "Morgen, Tag and Abend are masculine and take “Guten” in these greetings; Nacht is feminine and takes “Gute”. Teach the greetings as fixed phrases at A1.",
    topic: "greetings",
    detect: /\b(guten nacht|gute (morgen|tag|abend))\b/i,
  },
];

/** The list as the text that goes into a prompt. */
export function trapsForPrompt(traps: readonly CommonTrap[] = COMMON_TRAPS): string {
  return traps.map((t, i) => `${i + 1}. WRONG: ${t.wrong}\n   RIGHT: ${t.right}\n   WHY: ${t.why}`).join("\n");
}
