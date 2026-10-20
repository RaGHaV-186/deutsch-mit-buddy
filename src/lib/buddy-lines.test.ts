import { SESSIONS } from "@data/curriculum";
import { describe, expect, it } from "vitest";
import messages from "../../messages/en.json";
import { homeLine, lessonTitle } from "./buddy-lines";

const lesson = SESSIONS.find((s) => s.code === "Z9")!;
const exam = SESSIONS.find((s) => s.code === "W14.1")!;
const byKind = (kind: string) => SESSIONS.find((s) => s.kind === kind)!;

describe("homeLine", () => {
  it("is the same all day and changes from day to day for lessons", () => {
    expect(homeLine(lesson, 11)).toEqual(homeLine(lesson, 11));
    const keys = new Set(Array.from({ length: 10 }, (_, d) => homeLine(lesson, d).key));
    expect(keys.size).toBeGreaterThan(2);
  });

  it("one of the lesson lines names the lesson's theme", () => {
    const themed = Array.from({ length: 5 }, (_, d) => homeLine(lesson, d)).find((l) => l.key === "theme")!;
    expect(themed.theme).toBe("Essen & Trinken, im Café bestellen");
  });

  it("a lesson without a theme (exam lessons) never gets the theme line", () => {
    for (let d = 0; d < 10; d++) expect(homeLine(exam, d).key).not.toBe("theme");
  });

  it("weekends, tests and buffer days have their own lines; no session gives a safe default", () => {
    expect(homeLine(byKind("saturday"), 3).key).toBe("review");
    expect(homeLine(byKind("sunday"), 3).key).toBe("test");
    expect(homeLine(byKind("test"), 3).key).toBe("test");
    expect(homeLine(byKind("buffer"), 3).key).toBe("catchUp");
    expect(homeLine(undefined, 3).key).toBe("letsGo");
  });

  it("every line has German text, and a negative day count doesn't break it", () => {
    const lines = messages.Buddy.home as Record<string, string>;
    for (const d of [-5, 0, 1, 99]) expect(lines[homeLine(lesson, d).key]).toBeTruthy();
    expect(lines.theme).toContain("{theme}");
  });
});

describe("lessonTitle", () => {
  it("uses the theme, or the grammar point when there is no theme", () => {
    expect(lessonTitle(lesson)).toBe("Essen & Trinken, im Café bestellen");
    expect(lessonTitle(exam)).toBe(exam.grammar);
  });
});
