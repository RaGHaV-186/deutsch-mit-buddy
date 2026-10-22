import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { validLesson } from "@/lib/content/test-fixtures";
import { renderWithIntl } from "@/test-utils";
import { LearnView, type LearnLesson } from "./LearnView";
import { LessonReader } from "./LessonReader";

const lesson: LearnLesson = {
  day: 11,
  code: "Z9",
  title: "Essen & Trinken",
  grammar: "Irregular Präsens + möchten",
  goal: "Order food and drinks",
  published: true,
  cards: { total: 23, fresh: 9 },
};

describe("LearnView", () => {
  it("today's lesson: day and code, theme, goal, grammar, the cards, and the parts in order", () => {
    renderWithIntl(<LearnView lesson={lesson} kind="lesson" />);
    expect(screen.getByRole("heading", { level: 1, name: "Essen & Trinken" })).toBeInTheDocument();
    expect(screen.getByText("Day 11 · Z9")).toBeInTheDocument();
    expect(screen.getByText(/Order food and drinks/)).toBeInTheDocument();
    expect(screen.getByText("Irregular Präsens + möchten")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Read today's lesson" })).toHaveAttribute("href", "/learn/Z9");
    expect(screen.getByText("23 cards, 9 still new")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review cards" })).toHaveAttribute("href", "/cards");
    const parts = screen.getAllByRole("listitem");
    expect(parts).toHaveLength(14);
    expect(parts[0]).toHaveTextContent("1Can-do goal");
    expect(parts[13]).toHaveTextContent("14Close day");
  });

  it("exercises and the day exam are listed but not opened (they come with the lesson player)", () => {
    renderWithIntl(<LearnView lesson={lesson} kind="lesson" />);
    const [, , , exercises] = screen.getAllByRole("listitem");
    expect(exercises).toHaveTextContent("Exercises");
    expect(within(exercises).queryByRole("link")).toBeNull();
    const grammar = screen.getAllByRole("listitem")[2];
    expect(within(grammar).getByRole("link")).toHaveAttribute("href", "/learn/Z9#grammar");
    expect(screen.getByText(/arrive with the lesson player/)).toBeInTheDocument();
  });

  it("a lesson that is not published yet: a friendly message and the cards, no lesson link", () => {
    renderWithIntl(<LearnView lesson={{ ...lesson, published: false, goal: null }} kind="lesson" />);
    expect(screen.getByText(/not ready yet/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Read today's lesson" })).toBeNull();
    expect(screen.getByRole("link", { name: "Review cards" })).toHaveAttribute("href", "/cards");
  });

  it("a review, test or rest day has no lesson text yet", () => {
    renderWithIntl(<LearnView lesson={null} kind="other" />);
    expect(screen.getByRole("heading", { level: 1, name: "Learn" })).toBeInTheDocument();
    expect(screen.getByText(/review, test or rest day/)).toBeInTheDocument();
  });

  it("the Learn tab is the active one", () => {
    renderWithIntl(<LearnView lesson={lesson} kind="lesson" />);
    expect(screen.getAllByRole("link", { name: "Learn" })[0]).toHaveAttribute("aria-current", "page");
  });
});

describe("LessonReader", () => {
  it("shows the teaching parts with their published text, and hides the questions and the day exam", () => {
    const l = validLesson();
    renderWithIntl(<LessonReader lesson={l} />);
    expect(screen.getByText(l.goal.can_do)).toBeInTheDocument();
    expect(screen.getByText(l.grammar.intro.title)).toBeInTheDocument();
    expect(screen.getByText(l.grammar.intro.rule_summary)).toBeInTheDocument();
    expect(screen.getByText(l.reading.passage.text)).toBeInTheDocument();
    expect(screen.getByText(l.closing.review_tomorrow)).toBeInTheDocument();
    // twelve sections: no exercises, no day exam
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(12);
    expect(screen.queryByRole("heading", { level: 2, name: "Exercises" })).toBeNull();
    expect(screen.queryByRole("heading", { level: 2, name: "Day exam" })).toBeNull();
    expect(screen.queryByText(l.exam.grammar_vocab[0].prompt)).toBeNull();
    expect(screen.queryByText(l.exercises.items[0].prompt)).toBeNull();
  });

  it("words are shown with their coloured article, and the model answer sits behind a button", () => {
    const l = validLesson();
    const { container } = renderWithIntl(<LessonReader lesson={l} />);
    const articles = container.querySelectorAll("[data-article]");
    expect(articles.length).toBeGreaterThanOrEqual(l.vocabulary.words.filter((w) => w.article).length);
    const details = container.querySelector("details")!;
    expect(details).not.toHaveAttribute("open");
    expect(within(details).getByText("Show a model answer")).toBeInTheDocument();
    expect(details).toHaveTextContent(l.writing.model_answer);
  });
});
