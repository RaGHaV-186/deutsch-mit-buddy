import { describe, expect, it } from "vitest";
import { backupPaths, dumpArgs, dumpProblems, isInsideRepo } from "./backup";

describe("backupPaths", () => {
  it("puts the three dumps in ~/backups/deutschmitbuddy with the local date", () => {
    expect(backupPaths("/Users/raghav", new Date(2026, 9, 23, 8, 5))).toEqual({
      schema: "/Users/raghav/backups/deutschmitbuddy/schema-2026-10-23.sql",
      data: "/Users/raghav/backups/deutschmitbuddy/data-2026-10-23.sql",
      auth: "/Users/raghav/backups/deutschmitbuddy/auth-2026-10-23.sql",
    });
  });
});

describe("isInsideRepo: backups never go into the repository", () => {
  it.each(["/code/app", "/code/app/", "/code/app/backups", "/code/app/../app/x.sql"])("%s is inside /code/app", (p) => expect(isInsideRepo(p, "/code/app")).toBe(true));
  it.each(["/Users/raghav/backups/deutschmitbuddy", "/code/app-backups", "/code", "/code/other/app"])("%s is outside /code/app", (p) => expect(isInsideRepo(p, "/code/app")).toBe(false));
  it("the default backup folder is outside any repo checkout in the home folder's code directory", () => {
    const repo = "/Users/raghav/code/deutsch-mit-buddy";
    for (const file of Object.values(backupPaths("/Users/raghav", new Date()))) expect(isInsideRepo(file, repo)).toBe(false);
  });
});

describe("dumpArgs", () => {
  it("dumps the linked project: schema, data only, and the auth schema's data only", () => {
    expect(dumpArgs("schema", "/f")).toEqual(["supabase", "db", "dump", "--linked", "-f", "/f"]);
    expect(dumpArgs("data", "/f")).toEqual(["supabase", "db", "dump", "--linked", "-f", "/f", "--data-only"]);
    expect(dumpArgs("auth", "/f")).toEqual(["supabase", "db", "dump", "--linked", "-f", "/f", "--data-only", "--schema", "auth"]);
  });
});

describe("dumpProblems", () => {
  const body = (extra: string) => `-- dump\n${extra}\n${"-- filler line\n".repeat(20)}`;
  it("accepts a plausible dump of each kind", () => {
    expect(dumpProblems("schema", body('CREATE TABLE "public"."profiles" (id uuid);\nCREATE TABLE "public"."cards" (id uuid);\nRESET ALL;'))).toEqual([]);
    expect(dumpProblems("data", body('INSERT INTO "public"."profiles" VALUES (1);\nINSERT INTO "public"."cards" VALUES (1);'))).toEqual([]);
    expect(dumpProblems("auth", body('INSERT INTO "auth"."users" VALUES (1);'))).toEqual([]);
  });
  it("rejects an empty file, a missing table and a cut-off file", () => {
    expect(dumpProblems("data", "")).toEqual(["the file is empty or tiny"]);
    expect(dumpProblems("data", body('INSERT INTO "public"."profiles" VALUES (1);'))).toContain("no cards data");
    expect(dumpProblems("schema", body('CREATE TABLE "public"."profiles" (id uuid);'))).toContain('no "public"."cards" table');
    expect(dumpProblems("auth", body("INSERT INTO other VALUES (1);"))).toContain("no auth users data");
    const cut = `${"-- filler line\n".repeat(20)}INSERT INTO "public"."profiles" VALUES (1);\nINSERT INTO "public"."cards" VALUES (1, 'abc`;
    expect(dumpProblems("data", cut).some((p) => p.includes("cut off"))).toBe(true);
  });
});
