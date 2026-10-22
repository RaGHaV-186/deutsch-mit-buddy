// Lesson content pipeline (slice 3). Sonnet writes each lesson in four passes (A: teaching parts; B: reading, listening, writing,
// speaking; C: day exam; D: warm-up, culture, mission, close day), Opus checks every item, and a lesson is published only when every item is ok or fixed.
// Every paid step shows an estimate first and needs its id to run.
//
//   node --env-file=.env.local --no-warnings scripts/content.mts <command> --run <name> [options]
//
//   estimate --stage generate-a|generate-b|generate-c|generate-d|review [--lessons Z1,Z2,Z3 | --all] [--exact]   cost estimate, nothing is paid
//   run      --stage generate-a|generate-b|generate-c|generate-d|review --approve <estimate id>                   the paid Batch run (resumable)
//   check                                         free: automatic checks on the lessons written so far (run before the review pass)
//   estimate|run --stage review --fixes           Opus re-checks ONLY the items corrected in manual-fixes.json (item id -> { value, reason }); the rest of the lesson keeps its verdicts
//   run ... --submit-only                         submit the batch, save its id and stop (run the same command later to collect the result)
//   estimate|run ... --direct                     no batch: ordinary Messages API calls at list price (twice the batch price), answers at once; finished answers are saved in <stage>.direct.json so a rerun never pays twice. Its estimate has its own id (…-direct)
//   build                                         merge the passes into the review file (review.json, review.md, ...)
//   markdown --lesson Z1 [--out path.md]          one lesson as readable Markdown, with the review notes
//   publish  [--yes]                              publish every lesson that has no open item (writes to the database)
//
// Everything lands in data/generated/<name>/. ANTHROPIC_API_KEY is read from .env.local only.
import Anthropic from "@anthropic-ai/sdk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { SESSIONS } from "../data/curriculum.ts";
import { lessonsOf, type CurriculumRow } from "../src/lib/content/curriculum-rows.ts";
import { lintLesson } from "../src/lib/content/lesson-lint.ts";
import { lessonToMarkdown } from "../src/lib/content/lesson-text.ts";
import type { Lesson, PassA, PassB, PassC, PassD, ReviewVerdict } from "../src/lib/content/lesson-schema.ts";
import {
  assertApproved,
  buildPassARequests,
  buildPassBRequests,
  buildPassCRequests,
  buildPassDRequests,
  buildReviewRequests,
  combineLesson,
  costReport,
  estimateStage,
  lintErrors,
  applyManualFixes,
  currentVerdicts,
  manualFixIds,
  mergeLesson,
  parsePassA,
  parsePassB,
  parsePassC,
  parsePassD,
  parseReview,
  publishPayload,
  runBatch,
  runDirect,
  summarize,
  type BatchClient,
  type BatchRequest,
  type LessonReview,
  type ManualFixes,
  type Stage,
} from "../src/lib/content/pipeline.ts";
import { DEFAULT_USD_TO_EUR } from "../src/lib/content/pricing.ts";
import { partialReviewExpectedOutput, REVIEW_MODEL } from "../src/lib/content/prompts.ts";
import { adminClient } from "./lib/supabase-admin.mts";

const args = process.argv.slice(2);
const command = args[0];
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1]?.startsWith("--") || args[i + 1] === undefined ? "true" : args[i + 1]) : undefined;
};
const fail = (message: string): never => {
  console.error(`\n${message}\n`);
  process.exit(1);
};

const runName = flag("run") ?? fail("Give the run a name, for example --run sample-z1-z3.");
if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(runName)) fail("The run name may only contain lowercase letters, digits and dashes.");
const dir = join("data", "generated", runName);
mkdirSync(dir, { recursive: true });
const file = (name: string) => join(dir, name);
const read = <T,>(name: string): T | undefined => (existsSync(file(name)) ? (JSON.parse(readFileSync(file(name), "utf8")) as T) : undefined);
const write = (name: string, data: unknown) => writeFileSync(file(name), JSON.stringify(data, null, 2) + "\n");
const rate = process.env.USD_TO_EUR ? Number(process.env.USD_TO_EUR) : DEFAULT_USD_TO_EUR;
const modeOf = (): "batch" | "direct" => (flag("direct") ? "direct" : "batch");
const STAGES: Stage[] = ["generate-a", "generate-b", "generate-c", "generate-d", "review"];

const allLessons = lessonsOf(SESSIONS);
function runLessons(): CurriculumRow[] {
  const saved = read<{ codes: string[] }>("lessons.json");
  const wanted = flag("all") ? allLessons.map((l) => l.code) : flag("lessons")?.split(",").map((c) => c.trim()).filter(Boolean);
  const codes = wanted ?? saved?.codes ?? fail("Say which lessons: --lessons Z1,Z2,Z3 or --all.");
  const unknown = codes.filter((c) => !allLessons.some((l) => l.code === c));
  if (unknown.length) fail(`Not lessons in data/curriculum.ts: ${unknown.join(", ")}`);
  if (wanted) write("lessons.json", { codes });
  return codes.map((c) => allLessons.find((l) => l.code === c)!);
}

interface Raw<T> {
  lessons: Record<string, T>;
  failures: { code: string; reason: string }[];
}
interface ReviewRaw {
  verdicts: Record<string, ReviewVerdict[]>;
  failures: { code: string; reason: string }[];
}
interface State {
  batches: { stage: Stage; id: string; fingerprint: string; submittedAt: string }[];
}

const manualFixes = () => read<ManualFixes>("manual-fixes.json") ?? {};
/** With --fixes the review covers only the corrected items (lesson code -> item ids). */
const reviewOnly = (): Map<string, string[]> | undefined => {
  if (!flag("fixes")) return undefined;
  const fixes = manualFixes();
  const codes = [...new Set(Object.keys(fixes).map((id) => id.split("#")[0]))];
  if (!codes.length) fail("manual-fixes.json holds no corrections: nothing to re-review.");
  return new Map(codes.map((c) => [c, manualFixIds(c, fixes)]));
};
/** The file name of a stage's results: the re-review of corrections keeps its own files, so the first review stays untouched. */
const tagOf = (stage: Stage) => (stage === "review" && flag("fixes") ? "review-fixes" : stage);

const completeLessons = (): Map<string, Lesson> => {
  const a = read<Raw<PassA>>("generate-a.raw.json")?.lessons ?? {};
  const b = read<Raw<PassB>>("generate-b.raw.json")?.lessons ?? {};
  const c = read<Raw<PassC>>("generate-c.raw.json")?.lessons ?? {};
  const d = read<Raw<PassD>>("generate-d.raw.json")?.lessons ?? {};
  const fixes = manualFixes();
  return new Map(Object.keys(a).filter((k) => b[k] && c[k] && d[k]).map((k) => [k, applyManualFixes(k, combineLesson(a[k], b[k], c[k], d[k]), fixes)]));
};

function requestsFor(stage: Stage, lessons: CurriculumRow[]): BatchRequest[] {
  if (stage === "generate-a") return buildPassARequests(lessons);
  if (stage === "generate-b" || stage === "generate-c" || stage === "generate-d") {
    const a = read<Raw<PassA>>("generate-a.raw.json") ?? fail("Run generate-a first (generate-a.raw.json is missing).");
    const passA = new Map(Object.entries(a.lessons));
    return stage === "generate-b" ? buildPassBRequests(lessons, passA) : stage === "generate-c" ? buildPassCRequests(lessons, passA) : buildPassDRequests(lessons, passA, allLessons);
  }
  const complete = completeLessons();
  if (complete.size === 0) fail("Run generate-a, generate-b, generate-c and generate-d first: no complete lesson yet.");
  // The free automatic checks come first: Opus is not paid to find what a script can find. Regenerate those lessons, or override with --allow-lint-errors.
  // A re-review looks at the corrected items only; what the first review settled (Opus corrections) is not blocked by the writers' raw text.
  const only = reviewOnly();
  const broken = lintErrors(lessons, complete)
    .map((b) => ({ ...b, issues: only ? b.issues.filter((i) => only.get(b.code)?.includes(i.id)) : b.issues }))
    .filter((b) => b.issues.length);
  if (broken.length && !flag("allow-lint-errors")) {
    for (const b of broken) {
      console.error(`\n${b.code} fails ${b.issues.length} automatic check(s):`);
      for (const i of b.issues) console.error(`  ${i.id}: ${i.message}`);
    }
    fail(`Not sent to the review: ${broken.map((b) => b.code).join(", ")}. Write those lessons again (estimate + run generate-a to generate-d with --lessons ${broken.map((b) => b.code).join(",")}), or add --allow-lint-errors to let Opus try to fix them.`);
  }
  return buildReviewRequests(only ? lessons.filter((l) => only.has(l.code)) : lessons, complete, allLessons, only);
}

function printEstimate(e: ReturnType<typeof estimateStage>, lessons: CurriculumRow[]) {
  const eur = (n: number) => `€${n.toFixed(2)}`;
  console.log(`
Estimate for the "${e.stage}" pass of run "${runName}" (${lessons.map((l) => l.code).join(", ")})
  Model:            ${e.model} (${e.mode === "direct" ? "direct Messages API calls, full list price" : "Batch API, 50% off list price"})
  Requests:         ${e.requests}
  Input tokens:     ~${e.inputTokens.toLocaleString("en")}
  Output tokens:    ~${e.expectedOutputTokens.toLocaleString("en")} expected, at most ${e.ceilingOutputTokens.toLocaleString("en")}
  Expected cost:    ${eur(e.expectedEur)}   ($${e.expectedUsd.toFixed(3)})
  Worst case:       ${eur(e.ceilingEur)}   (every request using its whole token limit; the run cannot cost more)
  Rate used:        $1 = €${e.usdToEur} (override with USD_TO_EUR)
  Hard cap:         €10 per pass
  Estimate id:      ${e.id}
`);
}

/** Free: the automatic checks on every complete lesson of the run, so problems are found before the paid review. */
function checkCommand() {
  const complete = completeLessons();
  if (complete.size === 0) fail("No complete lesson in this run yet (generate-a to generate-d).");
  const lessons = [...complete.keys()].map((c) => allLessons.find((l) => l.code === c)!);
  const broken = lintErrors(lessons, complete);
  for (const l of lessons) {
    const b = broken.find((x) => x.code === l.code);
    console.log(`${l.code}: ${b ? `${b.issues.length} error(s)` : "no errors"}`);
    for (const i of b?.issues ?? []) console.log(`  ${i.id}: ${i.message}`);
  }
  console.log(broken.length ? "\nFix these (write the lessons again) before the review pass." : "\nOK to send to the review.");
  // After a review: the same checks on the lessons as they would be published (writers' text + Opus corrections + the course owner's corrections).
  if (existsSync(file("review.raw.json"))) {
    const { reviews } = buildReviews();
    console.log("\nAfter the review (the lessons as they would be published):");
    for (const r of reviews) {
      const row = allLessons.find((l) => l.code === r.code)!;
      const errors = lintLesson(r.code, row.phase, r.final, { first: row.seq === 0 }).filter((i) => i.level === "error");
      console.log(`${r.code}: ${errors.length ? `${errors.length} error(s)` : "no errors"}${r.publishable ? ", publishable" : ", blocked"}`);
      for (const i of errors) console.log(`  ${i.id}: ${i.message}`);
    }
  }
}

/** A re-review of a few corrected items is far smaller than a whole-lesson review. */
const expectedOutputFor = (stage: Stage) => {
  const only = stage === "review" ? reviewOnly() : undefined;
  return only ? partialReviewExpectedOutput(Math.max(...[...only.values()].map((ids) => ids.length))) : undefined;
};

function stageArg(): Stage {
  const stage = flag("stage") as Stage | undefined;
  if (!stage || !STAGES.includes(stage)) fail(`Give --stage ${STAGES.join(" | ")}.`);
  return stage as Stage;
}

async function estimateCommand() {
  const stage = stageArg();
  const lessons = runLessons();
  const requests = requestsFor(stage, lessons);
  let exactInputTokens: number[] | undefined;
  if (flag("exact")) {
    const client = new Anthropic();
    exactInputTokens = [];
    for (const r of requests) {
      const counted = await client.messages.countTokens({ model: r.params.model, system: r.params.system, messages: r.params.messages });
      exactInputTokens.push(counted.input_tokens);
    }
  }
  const estimate = estimateStage(stage, requests, { rate, exactInputTokens, expectedOutput: expectedOutputFor(stage), mode: modeOf() });
  write(`${tagOf(stage)}.estimate.json`, { ...estimate, lessons: lessons.map((l) => l.code), exactTokenCount: Boolean(exactInputTokens) });
  printEstimate(estimate, lessons);
}

async function runCommand() {
  const stage = stageArg();
  const lessons = runLessons();
  const requests = requestsFor(stage, lessons);
  const estimate = estimateStage(stage, requests, { rate, expectedOutput: expectedOutputFor(stage), mode: modeOf() });
  try {
    assertApproved(requests, flag("approve"), estimate);
  } catch (error) {
    printEstimate(estimate, lessons);
    fail((error as Error).message);
  }
  if (!process.env.ANTHROPIC_API_KEY) fail("ANTHROPIC_API_KEY is not set. Put it in .env.local (never in Vercel or a NEXT_PUBLIC variable).");
  const client = new Anthropic();
  const state = read<State>("state.json") ?? { batches: [] };
  const existing = state.batches.find((b) => b.stage === stage && b.fingerprint === estimate.id);

  let batchId: string;
  let lines: Awaited<ReturnType<typeof runBatch>>["lines"];
  let pending = false;
  if (modeOf() === "direct") {
    // No batch: every finished answer is written to <stage>.direct.json at once, and a rerun reuses them instead of paying again.
    const cacheName = `${tagOf(stage)}.direct.json`;
    const cache = read<Record<string, (typeof lines)[number]>>(cacheName) ?? {};
    batchId = "direct";
    lines = await runDirect(client as unknown as Parameters<typeof runDirect>[0], requests, {
      done: new Map(Object.entries(cache)),
      store: (line) => {
        cache[line.custom_id] = line;
        write(cacheName, cache);
      },
      concurrency: 3,
      log: (m) => console.log(m),
    });
  } else {
    ({ batchId, lines, pending } = await runBatch(client as unknown as BatchClient, requests, {
      submitOnly: Boolean(flag("submit-only")),
      batchId: existing?.id,
      onSubmitted: (id) => {
        state.batches.push({ stage, id, fingerprint: estimate.id, submittedAt: new Date().toISOString() });
        write("state.json", state); // saved before waiting, so a crash never leads to paying twice
      },
      log: (m) => console.log(m),
      pollMs: 30_000,
    }));
  }

  if (pending) {
    console.log(`\nBatch ${batchId} (${stage}, ${requests.length} requests) is saved in ${file("state.json")} and is not finished yet. Nothing more is paid or submitted. Say "continue" later and I run the same command again to collect it.`);
    return;
  }
  const covered = lessons.filter((l) => requests.some((r) => r.custom_id.endsWith(`-${l.code.replace(/[^A-Za-z0-9_-]/g, "_")}`)));
  let outcome;
  if (stage !== "review") {
    const parsed = stage === "generate-a" ? parsePassA(covered, lines) : stage === "generate-b" ? parsePassB(covered, lines) : stage === "generate-c" ? parsePassC(covered, lines) : parsePassD(covered, lines);
    const raw = read<Raw<unknown>>(`${stage}.raw.json`) ?? { lessons: {}, failures: [] };
    for (const [code, content] of parsed.results) raw.lessons[code] = content;
    raw.failures = parsed.failures;
    write(`${stage}.raw.json`, raw);
    outcome = parsed;
  } else {
    const parsed = parseReview(covered, completeLessons(), lines, reviewOnly());
    const raw = read<ReviewRaw>(`${tagOf(stage)}.raw.json`) ?? { verdicts: {}, failures: [] };
    for (const [code, verdicts] of parsed.results) raw.verdicts[code] = verdicts;
    raw.failures = parsed.failures;
    write(`${tagOf(stage)}.raw.json`, raw);
    outcome = parsed;
  }
  const report = costReport(stage, estimate, batchId, outcome, requests.length);
  write(`${tagOf(stage)}.report.json`, report);
  // The report file holds the latest pass of a stage; the ledger keeps every paid pass, so the run's total cost is never lost when a stage is run again.
  const ledger = read<unknown[]>("costs.json") ?? [];
  write("costs.json", [...ledger, { at: new Date().toISOString(), stage: tagOf(stage), lessons: covered.map((l) => l.code), batchId, actualEur: report.actualEur, estimatedEur: report.estimatedEur }]);
  console.log(`\nThe "${stage}" pass is done. Actual cost €${report.actualEur.toFixed(3)} (estimated €${estimate.expectedEur.toFixed(2)}, worst case €${estimate.ceilingEur.toFixed(2)}). Details: ${file(`${tagOf(stage)}.report.json`)}`);
  if (outcome.failures.length) {
    console.log(`${outcome.failures.length} lesson(s) failed and were not stored:`);
    for (const f of outcome.failures) console.log(`  ${f.code}: ${f.reason}`);
    console.log("Run the estimate and the pass again for just those lessons (--lessons ...).");
  }
}

function buildReviews(): { reviews: LessonReview[]; unreviewed: string[] } {
  const complete = completeLessons();
  const rev = read<ReviewRaw>("review.raw.json") ?? fail("review.raw.json is missing. Run the review pass first.");
  const rereview = read<ReviewRaw>("review-fixes.raw.json");
  const fixes = manualFixes();
  const reviews: LessonReview[] = [];
  const unreviewed: string[] = [];
  for (const [code, lesson] of complete) {
    // A corrected item counts only with the verdict of the re-review; before that it waits for a human.
    const verdicts = currentVerdicts(code, rev.verdicts[code], rereview?.verdicts[code], fixes);
    const row = allLessons.find((l) => l.code === code)!;
    if (!verdicts) unreviewed.push(code);
    else reviews.push(mergeLesson(row, lesson, verdicts));
  }
  return { reviews, unreviewed };
}

function buildCommand() {
  const { reviews, unreviewed } = buildReviews();
  const summary = summarize(reviews);
  const gen = { a: read<Raw<PassA>>("generate-a.raw.json"), b: read<Raw<PassB>>("generate-b.raw.json"), c: read<Raw<PassC>>("generate-c.raw.json"), d: read<Raw<PassD>>("generate-d.raw.json"), review: read<ReviewRaw>("review.raw.json") };
  write("review.json", {
    run: runName, builtAt: new Date().toISOString(), summary, unreviewedLessons: unreviewed,
    manualFixes: Object.keys(manualFixes()),
    failures: { generateA: gen.a?.failures ?? [], generateB: gen.b?.failures ?? [], generateC: gen.c?.failures ?? [], generateD: gen.d?.failures ?? [], review: gen.review?.failures ?? [] },
    lessons: reviews,
  });
  write("publish-payloads.json", Object.fromEntries(reviews.filter((r) => r.publishable).map((r) => [r.code, publishPayload(r)])));
  write("needs-human.json", reviews.flatMap((l) => l.items.filter((i) => i.status === "needs-human")));

  const lines = [`# Review of run ${runName}`, "", `${summary.items} items in ${summary.lessons} lessons: **${summary.ok} ok**, **${summary.fixed} fixed**, **${summary.needsHuman} need a human**.`, `Can be published: ${summary.publishable.join(", ") || "none"}. Blocked: ${summary.blocked.join(", ") || "none"}.`, ""];
  if (unreviewed.length) lines.push(`Lessons written but not reviewed yet: ${unreviewed.join(", ")}`, "");
  for (const l of reviews) {
    lines.push(`## ${l.code} ${l.publishable ? "(can be published)" : "(blocked)"}`);
    for (const issue of l.lessonIssues) lines.push(`- LESSON: ${issue}`);
    for (const id of manualFixIds(l.code, manualFixes())) lines.push(`- **CORRECTED BY THE COURSE OWNER** ${id}: ${manualFixes()[id].reason}`);
    for (const i of l.items.filter((x) => x.status !== "ok")) lines.push(`- **${i.status.toUpperCase()}** ${i.id} (${i.label}): ${i.reason}`);
    lines.push("");
  }
  writeFileSync(file("review.md"), lines.join("\n"));
  console.log(`Built review.json, publish-payloads.json, needs-human.json and review.md in ${dir}.`);
  console.log(`${summary.ok} ok, ${summary.fixed} fixed, ${summary.needsHuman} need a human. Publishable: ${summary.publishable.join(", ") || "none"}.`);
}

function markdownCommand() {
  const code = flag("lesson") ?? fail("Give --lesson Z1.");
  const review = read<{ lessons: LessonReview[] }>("review.json")?.lessons.find((l) => l.code === code);
  const row = allLessons.find((l) => l.code === code);
  if (!row) return fail(`Not a lesson: ${code}`);
  let lesson: Lesson | undefined = review?.final;
  const marks = new Map(review?.items.map((i) => [i.id, { status: i.status, reason: i.reason }]) ?? []);
  if (!lesson) {
    lesson = completeLessons().get(code);
    if (!lesson) fail(`No complete lesson ${code} in this run yet.`);
  }
  const out = flag("out") ? resolve(flag("out")!.replace(/^~(?=\/)/, homedir())) : file(`${code}.md`);
  writeFileSync(out, lessonToMarkdown({ code, phase: row.phase, theme: row.theme, grammar: row.grammar }, lesson!, marks));
  console.log(`Wrote ${out}`);
}

async function publishCommand() {
  const payloads = read<Record<string, ReturnType<typeof publishPayload>>>("publish-payloads.json") ?? fail("publish-payloads.json is missing. Run build first.");
  const db = adminClient(args);
  for (const [code, p] of Object.entries(payloads)) {
    const { error } = await db.rpc("publish_lesson", { p_code: code, p_parts: p.parts, p_status: p.part_status, p_model: REVIEW_MODEL, p_cards: p.cards, p_questions: p.questions });
    if (error) fail(`${code} was refused by the database: ${error.message}`);
    console.log(`Published ${code}: ${p.cards.length} cards, ${p.questions.length} questions, 14 parts.`);
  }
  if (Object.keys(payloads).length === 0) console.log("Nothing to publish: no lesson is free of open items.");
}

try {
  if (command === "estimate") await estimateCommand();
  else if (command === "run") await runCommand();
  else if (command === "check") checkCommand();
  else if (command === "build") buildCommand();
  else if (command === "markdown") markdownCommand();
  else if (command === "publish") await publishCommand();
  else fail("Commands: estimate, run, check, build, markdown, publish. See the header of scripts/content.mts.");
} catch (error) {
  if (error instanceof Anthropic.APIError) fail(`Anthropic API error ${error.status}: ${error.message}`);
  throw error;
}
