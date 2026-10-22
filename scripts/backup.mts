// Manual backup of the hosted database: three dumps (schema, data, auth users) in ~/backups/deutschmitbuddy/, never inside the repo.
//   npm run backup
// Needs Docker running and the project linked (`npx supabase link`). The CLI asks for the database password: type it at the prompt (it is
// never printed or stored here). The Supabase Free plan has NO automatic backups, so run this before every release (docs/RELEASE-slice-3.md).
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { backupPaths, DUMP_KINDS, dumpArgs, dumpProblems, isInsideRepo } from "../src/lib/dev/backup.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const paths = backupPaths(homedir(), new Date());
const dir = dirname(paths.schema);
if (isInsideRepo(dir, repoRoot)) throw new Error(`Refusing to write backups inside the repo (${dir}).`);
if (process.argv.includes("--dry-run")) {
  console.log("Would write:", ...DUMP_KINDS.map((k) => `\n  ${paths[k]}`));
  process.exit(0);
}

mkdirSync(dir, { recursive: true, mode: 0o700 });
chmodSync(dir, 0o700);
const failed: string[] = [];
for (const kind of DUMP_KINDS) {
  const file = paths[kind];
  if (existsSync(file)) {
    console.error(`${file} exists already: move or delete it first (a backup is never overwritten).`);
    process.exit(1);
  }
  console.log(`\n→ ${kind} dump (the CLI may ask for the database password)`);
  const run = spawnSync("npx", dumpArgs(kind, file), { stdio: "inherit", cwd: repoRoot });
  if (run.status !== 0 || !existsSync(file)) {
    failed.push(`${kind}: the dump command failed`);
    continue;
  }
  chmodSync(file, 0o600); // the data and auth dumps hold personal data and password hashes
  const problems = dumpProblems(kind, readFileSync(file, "utf8"));
  console.log(`${problems.length ? "PROBLEM" : "ok"}  ${file}  ${(statSync(file).size / 1024).toFixed(0)} KB${problems.length ? "  " + problems.join("; ") : ""}`);
  failed.push(...problems.map((p) => `${kind}: ${p}`));
}
if (failed.length) {
  console.error(`\nThe backup is NOT valid:\n  ${failed.join("\n  ")}`);
  process.exit(1);
}
console.log(`\nBackup complete in ${dir}. Keep these files private; never commit them.`);
