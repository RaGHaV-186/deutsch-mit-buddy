// Curriculum content pipeline (slice 3): Sonnet writes each lesson's cards and questions, Opus checks every item,
// and only items that are "ok" or "fixed" are inserted. Every paid step shows an estimate first.
//
//   node --env-file=.env.local --no-warnings scripts/content.mts <command> --run <name> [options]
//
//   estimate --stage generate|review [--lessons Z1,Z2,Z3 | --all] [--exact]   cost estimate, no payment
//   run      --stage generate|review --approve <estimate id>                  the paid Batch run (resumable)
//   build                                                                     merge both passes into the review file
//   insert   [--yes]                                                          write approved items to the database
//
// Everything lands in data/generated/<name>/. ANTHROPIC_API_KEY is read from .env.local only.
import Anthropic from "@anthropic-ai/sdk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SESSIONS } from "../data/curriculum.ts";
import { lessonsOf, type CurriculumRow } from "../src/lib/content/curriculum-rows.ts";
import {
  approvedRows,
  assertApproved,
  buildGenerationRequests,
  buildReviewRequests,
  costReport,
  estimateStage,
  mergeLesson,
  parseGeneration,
  parseReview,
  runBatch,
  summarize,
  type BatchClient,
  type BatchRequest,
  type LessonReview,
  type Stage,
} from "../src/lib/content/pipeline.ts";
import { DEFAULT_USD_TO_EUR } from "../src/lib/content/pricing.ts";
import { verdictSchema, type LessonContent, type Verdict } from "../src/lib/content/schema.ts";
import { z } from "zod";
import { adminClient, upsertInBatches } from "./lib/supabase-admin.mts";

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

interface Raw {
  contents: Record<string, LessonContent>;
  failures: { code: string; reason: string }[];
}
interface ReviewRaw {
  verdicts: Record<string, Verdict[]>;
  failures: { code: string; reason: string }[];
}
interface State {
  batches: { stage: Stage; id: string; fingerprint: string; submittedAt: string }[];
}

function requestsFor(stage: Stage, lessons: CurriculumRow[]): BatchRequest[] {
  if (stage === "generate") return buildGenerationRequests(lessons);
  const raw = read<Raw>("generate.raw.json") ?? fail("Run the generate stage first (generate.raw.json is missing).");
  const contents = new Map(Object.entries(raw.contents));
  return buildReviewRequests(lessons, contents);
}

function printEstimate(e: ReturnType<typeof estimateStage>, lessons: CurriculumRow[]) {
  const eur = (n: number) => `€${n.toFixed(2)}`;
  console.log(`
Estimate for the "${e.stage}" pass of run "${runName}" (${lessons.map((l) => l.code).join(", ")})
  Model:            ${e.model} (Batch API, 50% off list price)
  Requests:         ${e.requests}
  Input tokens:     ~${e.inputTokens.toLocaleString("en")}
  Output tokens:    ~${e.expectedOutputTokens.toLocaleString("en")} expected, at most ${e.ceilingOutputTokens.toLocaleString("en")}
  Expected cost:    ${eur(e.expectedEur)}   ($${e.expectedUsd.toFixed(3)})
  Worst case:       ${eur(e.ceilingEur)}   (every request using its whole token limit; the run cannot cost more)
  Rate used:        $1 = €${e.usdToEur} (override with USD_TO_EUR)
  Hard cap:         €10 per run
  Estimate id:      ${e.id}
`);
}

async function estimateCommand() {
  const stage = (flag("stage") ?? fail("Give --stage generate or --stage review.")) as Stage;
  if (stage !== "generate" && stage !== "review") fail("--stage must be generate or review.");
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
  const estimate = estimateStage(stage, requests, { rate, exactInputTokens });
  write(`${stage}.estimate.json`, { ...estimate, lessons: lessons.map((l) => l.code), exactTokenCount: Boolean(exactInputTokens) });
  printEstimate(estimate, lessons);
}

async function runCommand() {
  const stage = (flag("stage") ?? fail("Give --stage generate or --stage review.")) as Stage;
  const lessons = runLessons();
  const requests = requestsFor(stage, lessons);
  const estimate = estimateStage(stage, requests, { rate });
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

  const { batchId, lines } = await runBatch(client as unknown as BatchClient, requests, {
    batchId: existing?.id,
    onSubmitted: (id) => {
      state.batches.push({ stage, id, fingerprint: estimate.id, submittedAt: new Date().toISOString() });
      write("state.json", state); // saved before waiting, so a crash never leads to paying twice
    },
    log: (m) => console.log(m),
    pollMs: 30_000,
  });

  if (stage === "generate") {
    const outcome = parseGeneration(lessons, lines);
    const raw = read<Raw>("generate.raw.json") ?? { contents: {}, failures: [] };
    for (const [code, content] of outcome.results) raw.contents[code] = content;
    raw.failures = outcome.failures;
    write("generate.raw.json", raw);
    write("generate.report.json", costReport("generate", estimate, batchId, outcome, requests.length));
    report("generate", outcome.failures, costReport("generate", estimate, batchId, outcome, requests.length).actualEur, estimate.expectedEur);
  } else {
    const gen = read<Raw>("generate.raw.json")!;
    const outcome = parseReview(lessons, new Map(Object.entries(gen.contents)), lines);
    const raw = read<ReviewRaw>("review.raw.json") ?? { verdicts: {}, failures: [] };
    for (const [code, verdicts] of outcome.results) raw.verdicts[code] = verdicts;
    raw.failures = outcome.failures;
    write("review.raw.json", raw);
    write("review.report.json", costReport("review", estimate, batchId, outcome, requests.length));
    report("review", outcome.failures, costReport("review", estimate, batchId, outcome, requests.length).actualEur, estimate.expectedEur);
  }
}

function report(stage: string, failures: { code: string; reason: string }[], actualEur: number, expectedEur: number) {
  console.log(`\nThe "${stage}" pass is done. Actual cost €${actualEur.toFixed(3)} (estimated €${expectedEur.toFixed(2)}). Details: ${file(`${stage}.report.json`)}`);
  if (failures.length) {
    console.log(`${failures.length} lesson(s) failed and were not stored:`);
    for (const f of failures) console.log(`  ${f.code}: ${f.reason}`);
    console.log("Run the estimate and the pass again for just those lessons (--lessons ...).");
  }
}

function buildCommand() {
  const gen = read<Raw>("generate.raw.json") ?? fail("generate.raw.json is missing.");
  const rev = read<ReviewRaw>("review.raw.json") ?? fail("review.raw.json is missing. Run the review pass first.");
  const reviews: LessonReview[] = [];
  const unreviewed: string[] = [];
  for (const [code, content] of Object.entries(gen.contents)) {
    const verdicts = rev.verdicts[code];
    if (!verdicts) unreviewed.push(code);
    else reviews.push(mergeLesson(code, content, z.array(verdictSchema).parse(verdicts)));
  }
  const rows = approvedRows(reviews);
  const summary = summarize(reviews);
  const needsHuman = reviews.flatMap((l) => l.items.filter((i) => i.status === "needs-human"));
  write("review.json", { run: runName, builtAt: new Date().toISOString(), summary, unreviewedLessons: unreviewed, generationFailures: gen.failures, reviewFailures: rev.failures, lessons: reviews });
  write("approved.json", rows);
  write("needs-human.json", needsHuman);

  const lines = [
    `# Review of run ${runName}`,
    "",
    `${summary.items} items in ${summary.lessons} lessons: **${summary.ok} ok**, **${summary.fixed} fixed**, **${summary.needsHuman} need a human**.`,
    `Only ok and fixed items are inserted (${rows.cards.length} cards, ${rows.questions.length} questions).`,
    "",
  ];
  if (unreviewed.length) lines.push(`Lessons generated but not reviewed yet: ${unreviewed.join(", ")}`, "");
  for (const l of reviews) {
    lines.push(`## ${l.code}`);
    for (const issue of l.lessonIssues) lines.push(`- LESSON: ${issue}`);
    for (const i of l.items.filter((x) => x.status !== "ok")) {
      lines.push(`- **${i.status.toUpperCase()}** ${i.id}: ${i.reason}`);
    }
    lines.push("");
  }
  writeFileSync(file("review.md"), lines.join("\n"));
  console.log(`Built ${file("review.json")}, approved.json, needs-human.json and review.md.`);
  console.log(`${summary.ok} ok, ${summary.fixed} fixed, ${summary.needsHuman} need a human.`);
}

const cardRow = z.object({
  session_code: z.string().min(1).max(12),
  kind: z.literal("word"),
  tier: z.enum(["core", "bonus"]),
  position: z.number().int().min(1),
  en: z.string().min(1).max(300),
  article: z.enum(["der", "die", "das"]).nullable(),
  de: z.string().min(1).max(300),
  plural: z.string().max(200).nullable(),
  example: z.string().max(300).nullable(),
  example_en: z.string().max(300).nullable(),
  tip: z.string().max(300).nullable(),
});
const questionRow = z.object({
  session_code: z.string().min(1).max(12),
  skill: z.string(),
  type: z.string(),
  prompt: z.string().min(1).max(500),
  answer: z.string().min(1).max(300),
  distractors: z.array(z.string()).max(6),
  explanation: z.string().max(400),
});

async function insertCommand() {
  const approved = read<{ cards: unknown[]; questions: unknown[] }>("approved.json") ?? fail("approved.json is missing. Run build first.");
  const cards = z.array(cardRow).parse(approved.cards);
  const questions = z.array(questionRow).parse(approved.questions);
  const db = adminClient(args);
  const known = new Set(((await db.from("curriculum_sessions").select("code").eq("kind", "lesson")).data ?? []).map((r) => r.code as string));
  const missing = [...new Set([...cards, ...questions].map((r) => r.session_code))].filter((c) => !known.has(c));
  if (missing.length) fail(`These lessons are not in curriculum_sessions yet (run npm run seed:curriculum): ${missing.join(", ")}`);
  await upsertInBatches(db, "card_templates", cards, "session_code,kind,de,en");
  await upsertInBatches(db, "question_bank", questions, "session_code,type,prompt");
  console.log(`Inserted ${cards.length} cards and ${questions.length} questions (existing ones were updated, none duplicated).`);
}

try {
  if (command === "estimate") await estimateCommand();
  else if (command === "run") await runCommand();
  else if (command === "build") buildCommand();
  else if (command === "insert") await insertCommand();
  else fail("Commands: estimate, run, build, insert. See the header of scripts/content.mts.");
} catch (error) {
  if (error instanceof Anthropic.APIError) fail(`Anthropic API error ${error.status}: ${error.message}`);
  throw error;
}
