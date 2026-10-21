// Puts data/curriculum.ts into the curriculum_sessions table. Safe to run again (upserts by seq).
//   node --env-file=.env.local --no-warnings scripts/seed-curriculum.mts [--yes]
import { SESSIONS } from "../data/curriculum.ts";
import { toCurriculumRows } from "../src/lib/content/curriculum-rows.ts";
import { adminClient, upsertInBatches } from "./lib/supabase-admin.mts";

const db = adminClient(process.argv);
const rows = toCurriculumRows(SESSIONS);
await upsertInBatches(db, "curriculum_sessions", rows, "seq");

const { count, error } = await db.from("curriculum_sessions").select("*", { count: "exact", head: true });
if (error) throw error;
// Rows beyond the plan would mean the plan shrank; report them instead of deleting anything.
console.log(`Upserted ${rows.length} sessions (${rows.filter((r) => r.kind === "lesson").length} lessons). The table now holds ${count}.`);
if ((count ?? 0) > rows.length) console.warn(`Warning: ${(count ?? 0) - rows.length} rows are not in data/curriculum.ts.`);
