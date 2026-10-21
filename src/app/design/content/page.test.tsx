import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { itemIdsOf, mergeLesson, summarize } from "@/lib/content/pipeline";
import type { ReviewVerdict } from "@/lib/content/lesson-schema";
import { lessonRow, validLesson } from "@/lib/content/test-fixtures";
import type { RunView } from "@/lib/content/preview";

const lesson = validLesson();
const row = lessonRow({ code: "Z1", seq: 0 });
const fixedCard = { ...lesson.vocabulary.words[0], example: "Ich trinke gern Kaffee." };
const verdicts: ReviewVerdict[] = itemIdsOf("Z1", lesson).map((id) =>
  id === "Z1#vocabulary.w01"
    ? { id, status: "fixed", reason: "Example was awkward", fixed_json: JSON.stringify(fixedCard) }
    : id === "Z1#reading.q2"
      ? { id, status: "needs-human", reason: "Doubtful level", fixed_json: null }
      : { id, status: "ok", reason: "fine", fixed_json: null },
);
const review = mergeLesson(row, lesson, verdicts);
const run: RunView = {
  name: "sample-z1-z3",
  generated: { Z1: lesson },
  review: { run: "sample-z1-z3", builtAt: "2026-10-22T10:00:00Z", summary: summarize([review]), unreviewedLessons: [], failures: { generateA: [], generateB: [], generateC: [], review: [] }, lessons: [review] },
  reports: { "generate-a": null, "generate-b": null, "generate-c": null, review: null },
};
const unreviewed: RunView = { ...run, name: "raw", review: null };

vi.mock("@/lib/content/preview", () => ({
  loadRun: (n: string) => (n === "sample-z1-z3" ? run : n === "raw" ? unreviewed : null),
  listRuns: () => ["sample-z1-z3", "raw"],
}));

import ContentPreviewPage from "./page";

afterEach(() => vi.unstubAllEnvs());
const open = async (params: Record<string, string> = {}) => render(await ContentPreviewPage({ searchParams: Promise.resolve(params) }));

describe("/design/content", () => {
  it("is hidden in production unless SHOW_DESIGN_PAGE=1", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SHOW_DESIGN_PAGE", "");
    await expect(ContentPreviewPage({ searchParams: Promise.resolve({}) })).rejects.toThrow();
  });

  it("shows the totals and says the lesson is blocked while an item needs a human", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await open({ run: "sample-z1-z3" });
    expect(screen.getByText("93 items in 1 lessons")).toBeInTheDocument();
    expect(screen.getByText("91 ok")).toBeInTheDocument();
    expect(screen.getByText("1 need a human")).toBeInTheDocument();
    expect(screen.getByText(/Z1: blocked, items need a human/)).toBeInTheDocument();
  });

  it("shows every one of the 14 parts with its number and title", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await open({ run: "sample-z1-z3" });
    for (const title of ["0. Can-do goal", "1. Warm-up: spaced grammar review", "2. Grammar", "3. Exercises", "4. Vocabulary and useful phrases", "5. Pronunciation focus", "6. Reading", "7. Listening", "8. Writing task", "9. Speaking drill and Tandem scenario", "10. Culture note", "11. Real-world mission", "12. Day exam", "13. Close day"]) {
      expect(screen.getAllByRole("heading", { level: 2 }).some((h) => h.textContent?.startsWith(title)), title).toBe(true);
    }
  });

  it("shows the German content and each item's verdict and reason", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await open({ run: "sample-z1-z3" });
    expect(screen.getByText(/Anna: Hallo Jonas, was trinkst du heute im Café\?/)).toBeInTheDocument();
    expect(screen.getByText(/Doubtful level/)).toBeInTheDocument();
  });

  it("a fixed item shows before and after", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await open({ run: "sample-z1-z3" });
    expect(screen.getByText("Before")).toBeInTheDocument();
    expect(screen.getByText("After (published)")).toBeInTheDocument();
    expect(screen.getByText(/Ich trinke gern Kaffee\./)).toBeInTheDocument();
  });

  it("can show only what needs a human", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await open({ run: "sample-z1-z3", show: "needs-human" });
    expect(screen.getByText(/Doubtful level/)).toBeInTheDocument();
    expect(screen.queryByText("Before")).toBeNull();
    expect(screen.queryByText(/Z1#goal/)).toBeNull();
  });

  it("a run that has not been reviewed yet shows the generated lesson without verdicts", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await open({ run: "raw" });
    expect(screen.getByText(/Not reviewed yet/)).toBeInTheDocument();
    expect(screen.getByText(/Anna: Hallo Jonas/)).toBeInTheDocument();
    expect(screen.queryByText(/needs human/i)).toBeNull();
  });

  it("an unknown run says so instead of failing", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await open({ run: "does-not-exist" });
    expect(screen.getByText(/No run found/)).toBeInTheDocument();
  });
});
