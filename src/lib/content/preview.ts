import "server-only";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CostReport, LessonReview } from "./pipeline";
import type { Lesson } from "./lesson-schema";

// Reads a generation run from data/generated/<name>/ for the dev-only preview page.

// Read at request time from the working directory. The ignore comments keep the bundler from tracing the whole project.
export const GENERATED_DIR = join(/* turbopackIgnore: true */ process.cwd(), "data", "generated");
export const RUN_NAME = /^[a-z0-9][a-z0-9-]{0,40}$/;

export interface ReviewFile {
  run: string;
  builtAt: string;
  summary: { lessons: number; items: number; ok: number; fixed: number; needsHuman: number; publishable: string[]; blocked: string[] };
  unreviewedLessons: string[];
  failures: { generateA: { code: string; reason: string }[]; generateB: { code: string; reason: string }[]; review: { code: string; reason: string }[] };
  lessons: LessonReview[];
}

export interface RunView {
  name: string;
  review: ReviewFile | null;
  /** Complete lessons (pass A + pass B) as Sonnet wrote them; shown when there is no review file yet. */
  generated: Record<string, Lesson> | null;
  reports: { "generate-a": CostReport | null; "generate-b": CostReport | null; review: CostReport | null };
}

function readJson<T>(path: string): T | null {
  try {
    return existsSync(/* turbopackIgnore: true */ path) ? (JSON.parse(readFileSync(/* turbopackIgnore: true */ path, "utf8")) as T) : null;
  } catch {
    return null;
  }
}

export function listRuns(base = GENERATED_DIR): string[] {
  try {
    return readdirSync(/* turbopackIgnore: true */ base, { withFileTypes: true }).filter((e) => e.isDirectory() && RUN_NAME.test(e.name)).map((e) => e.name).sort();
  } catch {
    return [];
  }
}

/** Returns null for a name that is not a valid run folder (the name comes from the URL, so it is checked, never joined blindly). */
export function loadRun(name: string, base = GENERATED_DIR): RunView | null {
  if (!RUN_NAME.test(name)) return null;
  const dir = join(base, name);
  if (!existsSync(/* turbopackIgnore: true */ dir)) return null;
  const a = readJson<{ lessons: Record<string, object> }>(join(dir, "generate-a.raw.json"));
  const b = readJson<{ lessons: Record<string, object> }>(join(dir, "generate-b.raw.json"));
  const generated = a ? Object.fromEntries(Object.keys(a.lessons).filter((c) => b?.lessons[c]).map((c) => [c, { ...a.lessons[c], ...b!.lessons[c] } as Lesson])) : null;
  return {
    name,
    review: readJson<ReviewFile>(join(dir, "review.json")),
    generated,
    reports: {
      "generate-a": readJson<CostReport>(join(dir, "generate-a.report.json")),
      "generate-b": readJson<CostReport>(join(dir, "generate-b.report.json")),
      review: readJson<CostReport>(join(dir, "review.report.json")),
    },
  };
}
