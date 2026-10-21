import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listRuns, loadRun, RUN_NAME } from "./preview";
import { validPassA, validPassB } from "./test-fixtures";

let base: string;
beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), "runs-"));
});
afterEach(() => rmSync(base, { recursive: true, force: true }));

describe("run names", () => {
  it("only lowercase letters, digits and dashes", () => {
    for (const ok of ["sample-z1-z3", "full", "run2"]) expect(RUN_NAME.test(ok)).toBe(true);
    for (const bad of ["../etc", "a/b", "A", "-x", "", "x".repeat(60), "a b", "a.json"]) expect(RUN_NAME.test(bad)).toBe(false);
  });
});

describe("loadRun", () => {
  it("reads the generated content, the review file and the cost reports of a run", () => {
    mkdirSync(join(base, "sample"));
    writeFileSync(join(base, "sample", "generate-a.raw.json"), JSON.stringify({ lessons: { Z1: validPassA(), Z2: validPassA() }, failures: [] }));
    writeFileSync(join(base, "sample", "generate-b.raw.json"), JSON.stringify({ lessons: { Z1: validPassB() }, failures: [] }));
    writeFileSync(join(base, "sample", "review.json"), JSON.stringify({ run: "sample", summary: { items: 93 }, lessons: [] }));
    writeFileSync(join(base, "sample", "generate-a.report.json"), JSON.stringify({ stage: "generate-a", actualEur: 0.05 }));
    const run = loadRun("sample", base)!;
    expect(run.name).toBe("sample");
    expect(Object.keys(run.generated!)).toEqual(["Z1"]); // Z2 has pass A only: not a complete lesson yet
    expect(Object.keys(run.generated!.Z1)).toHaveLength(14);
    expect(run.review!.summary.items).toBe(93);
    expect(run.reports["generate-a"]!.actualEur).toBe(0.05);
    expect(run.reports.review).toBeNull();
  });

  it("a run with nothing in it yet loads with empty parts", () => {
    mkdirSync(join(base, "empty"));
    expect(loadRun("empty", base)).toMatchObject({ review: null, generated: null });
  });

  it("refuses names that could reach other folders, and missing runs", () => {
    expect(loadRun("../outside", base)).toBeNull();
    expect(loadRun("a/b", base)).toBeNull();
    expect(loadRun("nope", base)).toBeNull();
  });

  it("survives a broken file", () => {
    mkdirSync(join(base, "bad"));
    writeFileSync(join(base, "bad", "review.json"), "{ not json");
    expect(loadRun("bad", base)!.review).toBeNull();
  });

  it("lists runs alphabetically and skips files and odd names", () => {
    mkdirSync(join(base, "b-run"));
    mkdirSync(join(base, "a-run"));
    mkdirSync(join(base, "Bad_Name"));
    writeFileSync(join(base, "file.txt"), "x");
    expect(listRuns(base)).toEqual(["a-run", "b-run"]);
    expect(listRuns(join(base, "missing"))).toEqual([]);
  });
});
