// The names a lesson may use. One list for the writers, the reviewer and the free lint.
export const FIRST_NAMES = ["Anna", "Jonas", "Lena"] as const;
export const TEACHER = "Buddy";
/** Generic surnames, only for formal address (Herr/Frau + surname, Mr/Mrs + surname). */
export const SURNAMES = ["Braun", "Weber", "Lang", "Schmidt", "Müller"] as const;

const list = (names: readonly string[]) => names.join(", ");

/** The rule as it goes into the writer and reviewer prompts. */
export const NAMES_RULE = `Never use real people's names. First names: only ${FIRST_NAMES.slice(0, -1).join(", ")} and ${FIRST_NAMES[FIRST_NAMES.length - 1]} (and ${TEACHER}, the teacher dog, where he speaks). A surname appears only in formal address (Herr/Frau + surname, Mr/Mrs + surname) and only from this fixed list: ${list(SURNAMES)}. No other surnames, no brands, no politics.`;

const TITLE = /\b(Herr|Frau|Mr|Mrs|Ms)\s+(\p{Lu}[\p{L}-]+)/gu;
const ALLOWED = new Set<string>([...SURNAMES]);

/** The surnames after a title (Herr, Frau, Mr, Mrs, Ms) in a text that are not on the fixed list. */
export function foreignSurnames(text: string): string[] {
  return [...text.matchAll(TITLE)].map((m) => m[2]).filter((name) => !ALLOWED.has(name));
}
