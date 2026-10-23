// Helpers for `npm run backup`: where the three dumps go, the safety rule (never inside the repo), and a sanity check of what came out.
import { relative, resolve, sep } from "node:path";

export const DUMP_KINDS = ["schema", "data", "auth"] as const;
export type DumpKind = (typeof DUMP_KINDS)[number];

/** `<home>/backups/deutschmitbuddy/<kind>-<YYYY-MM-DD>.sql` for each dump. */
export function backupPaths(home: string, date: Date): Record<DumpKind, string> {
  // The local calendar day (like `date +%F`), so the name matches the day the person ran it.
  const day = [date.getFullYear(), date.getMonth() + 1, date.getDate()].map((n, i) => String(n).padStart(i === 0 ? 4 : 2, "0")).join("-");
  const dir = resolve(home, "backups", "deutschmitbuddy");
  return Object.fromEntries(DUMP_KINDS.map((kind) => [kind, resolve(dir, `${kind}-${day}.sql`)])) as Record<DumpKind, string>;
}

/** True when `target` is the repo folder or anything below it. A dump holds personal data and password hashes: it must never land there. */
export const isInsideRepo = (target: string, repoRoot: string) => {
  const rel = relative(resolve(repoRoot), resolve(target));
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith(sep) && rel !== "..");
};

/** The arguments for `supabase db dump` for one kind (the project is the linked one). */
export function dumpArgs(kind: DumpKind, file: string): string[] {
  const base = ["supabase", "db", "dump", "--linked", "-f", file];
  if (kind === "schema") return base;
  if (kind === "data") return [...base, "--data-only"];
  return [...base, "--data-only", "--schema", "auth"];
}

/** What is wrong with a finished dump (empty list = it looks complete). A sanity check, not a restore test. */
export function dumpProblems(kind: DumpKind, text: string): string[] {
  const problems: string[] = [];
  if (text.trim().length < 200) return ["the file is empty or tiny"];
  if (kind === "schema") {
    if (!/CREATE TABLE/i.test(text)) problems.push("no CREATE TABLE statement");
    if (!/"public"\."profiles"/.test(text)) problems.push('no "public"."profiles" table');
    if (!/"public"\."cards"/.test(text)) problems.push('no "public"."cards" table');
  } else if (kind === "data") {
    if (!/"public"\."profiles"/.test(text)) problems.push("no profiles data");
    if (!/"public"\."cards"/.test(text)) problems.push("no cards data");
  } else if (!/"auth"\."users"/.test(text)) problems.push("no auth users data");
  // pg_dump writes its statements to the end: a cut-off file ends in the middle of one.
  const lastLine = text.trimEnd().split("\n").pop() ?? "";
  if (!/(;|^--.*|^$)\s*$/.test(lastLine)) problems.push(`the file seems cut off (last line: ${lastLine.slice(0, 60)})`);
  return problems;
}
