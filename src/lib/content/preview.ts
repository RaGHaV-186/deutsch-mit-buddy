import "server-only";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CostReport, LessonReview } from "./pipeline";
import type { LessonContent } from "./schema";

// Reads a generation run from data/generated/<name>/ for the dev-only preview page.

// Read at request time from the working directory. The ignore comments keep the bundler from tracing the whole project.
export const GENERATED_DIR = join(/* turbopackIgnore: true */ process.cwd(), "data", "generated");
export const RUN_NAME = /^[a-z0-9][a-z0-9-]{0,40}$/;

export interface ReviewFile {
  run: string;
  builtAt: string;
  summary: { lessons: number; items: number; ok: number; fixed: number; needsHuman: number; lessonsWithIssues: string[] };
  unreviewedLessons: string[];
  generationFailures: { code: string; reason: string }[];
  reviewFailures: { code: string; reason: string }[];
  lessons: LessonReview[];
}

export interface RunView {
  name: string;
  review: ReviewFile | null;
  /** Generated but not yet reviewed (only when no review file exists). */
  generated: Record<string, LessonContent> | null;
  reports: { generate: CostReport | null; review: CostReport | null };
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
  const raw = readJson<{ contents: Record<string, LessonContent> }>(join(dir, "generate.raw.json"));
  return {
    name,
    review: readJson<ReviewFile>(join(dir, "review.json")),
    generated: raw?.contents ?? null,
    reports: { generate: readJson<CostReport>(join(dir, "generate.report.json")), review: readJson<CostReport>(join(dir, "review.report.json")) },
  };
}
