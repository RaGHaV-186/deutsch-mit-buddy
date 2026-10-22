import { describe, expect, it } from "vitest";
import { errorIds, germanShare, lessonErrors, lintLesson, sentenceCount, sentencesAsked } from "./lesson-lint.ts";
import type { Lesson, Phase } from "./lesson-schema.ts";
import { validLesson } from "./test-fixtures.ts";

const lint = (mutate: (l: Lesson) => void, phase: Phase = "zero") => {
  const l = validLesson();
  mutate(l);
  return lintLesson("Z9", phase, l);
};
const ruleOf = (issues: { rule: string; id: string }[]) => issues.map((i) => `${i.id}:${i.rule}`);

describe("a complete lesson", () => {
  it("has no errors and no warnings", () => {
    expect(lintLesson("Z9", "zero", validLesson())).toEqual([]);
  });
});

describe("counts: a lesson with the wrong shape cannot publish", () => {
  it.each([
    ["words", (l: Lesson) => l.vocabulary.words.splice(14), null, "word-count"],
    ["phrases", (l: Lesson) => l.vocabulary.phrases.pop(), null, "phrase-count"],
    ["warm-up", (l: Lesson) => l.warmup.items.pop(), null, "warmup-count"],
    ["examples", (l: Lesson) => l.grammar.examples.splice(4), null, "example-count"],
    ["traps", (l: Lesson) => l.grammar.traps.splice(1), null, "trap-count"],
    ["exercises", (l: Lesson) => l.exercises.items.pop(), null, "exercise-count"],
    ["pronunciation words", (l: Lesson) => l.pronunciation.words.splice(5), null, "pron-words"],
    ["reading questions", (l: Lesson) => l.reading.questions.pop(), null, "reading-count"],
    ["listening questions", (l: Lesson) => l.listening.questions.pop(), null, "listening-count"],
    ["dialogue lines", (l: Lesson) => l.listening.passage.script.splice(5), null, "script-lines"],
    ["speaking drill", (l: Lesson) => l.speaking.drill.pop(), null, "drill-count"],
    ["exam grammar/vocabulary", (l: Lesson) => l.exam.grammar_vocab.pop(), null, "exam-gv-count"],
    ["exam reading questions", (l: Lesson) => l.exam.reading.questions.pop(), null, "exam-reading-count"],
    ["exam listening questions", (l: Lesson) => l.exam.listening.questions.pop(), null, "exam-listening-count"],
  ])("%s", (_name, shrink, _grow, rule) => {
    const issues = lint(shrink as (l: Lesson) => void);
    expect(issues.some((i) => i.id === "lesson" && i.level === "error" && i.rule === rule || (rule === "exercise-count" && i.rule === "exercise-mix"))).toBe(true);
  });

  it("the mix of exercise types is checked, not only the total", () => {
    const issues = lint((l) => {
      l.exercises.items[0] = { ...l.exercises.items[0], type: "multiple_choice", distractors: ["a", "b"] }; // a gap fill turned into multiple choice: total still 19
    });
    expect(ruleOf(issues)).toEqual(expect.arrayContaining(["lesson:exercise-mix"]));
    expect(lessonErrors(issues).length).toBeGreaterThan(0);
  });

  it("a lesson with too many words is refused too", () => {
    const issues = lint((l) => {
      for (let i = 0; i < 3; i++) l.vocabulary.words.push({ ...l.vocabulary.words[0], de: `Extra${i}`, example: `Extra${i} ist hier.` });
    });
    expect(ruleOf(issues)).toContain("lesson:word-count");
  });
});

describe("level bands", () => {
  it("a reading text or dialogue of the wrong length for the level is flagged for the reviewer", () => {
    const long = lint((l) => (l.reading.passage.text = Array(120).fill("Anna trinkt Kaffee und isst Brot.").join(" ")));
    expect(ruleOf(long)).toContain("Z9#reading.passage:reading-length");
    const short = lint((l) => (l.listening.passage.script = l.listening.passage.script.slice(0, 6).map((x) => ({ ...x, de: "Hallo Brot." }))));
    expect(ruleOf(short)).toContain("Z9#listening.passage:listening-length");
  });

  it("the same text is fine at B1 that is too long at A1", () => {
    const text = Array(25).fill("Anna trinkt Kaffee und isst Brot im Café.").join(" "); // ~200 words
    const a1 = lint((l) => (l.reading.passage.text = text), "A1");
    const b1 = lint((l) => (l.reading.passage.text = text), "B1");
    expect(ruleOf(a1)).toContain("Z9#reading.passage:reading-length");
    expect(ruleOf(b1)).not.toContain("Z9#reading.passage:reading-length");
  });

  it("writing tasks grow with the level: 30 words suits zero/A1, not B1 or C1", () => {
    expect(ruleOf(lint(() => {}, "A1"))).not.toContain("Z9#writing:writing-length");
    expect(ruleOf(lint(() => {}, "B1"))).toContain("Z9#writing:writing-length");
    expect(ruleOf(lint(() => {}, "C1"))).toContain("Z9#writing:writing-length");
  });

  it("a model answer must meet its own minimum word count (an error, in every lesson)", () => {
    const issues = lint((l) => (l.writing.model_answer = "Ich trinke Kaffee."));
    expect(issues.find((i) => i.rule === "model-answer-length")).toMatchObject({ id: "Z9#writing", level: "error" });
    expect(ruleOf(lint((l) => (l.writing.min_words = 39)))).not.toContain("Z9#writing:model-answer-length"); // the fixture's answer has 39 words
    expect(ruleOf(lint((l) => (l.writing.min_words = 40)))).toContain("Z9#writing:model-answer-length");
  });

  it("a model answer must have the number of sentences its task asks for", () => {
    const answer = "Ich heiße Anna. Ich komme aus Hamburg. Ich bin müde und hungrig. Mir geht es gut, danke. Wie heißt du?";
    const withTask = (task: string, min = 5) => ruleOf(lint((l) => { l.writing.task = task; l.writing.model_answer = answer; l.writing.min_words = min; }));
    expect(withTask("Write 5 short sentences about yourself.")).not.toContain("Z9#writing:model-answer-sentences");
    expect(withTask("Write 3 to 5 sentences.")).not.toContain("Z9#writing:model-answer-sentences");
    expect(withTask("Write 3 or 4 short sentences.")).toContain("Z9#writing:model-answer-sentences");
    expect(withTask("Write 6 sentences.")).toContain("Z9#writing:model-answer-sentences");
    expect(withTask("Schreibe mindestens 4 Sätze.")).not.toContain("Z9#writing:model-answer-sentences");
    expect(withTask("Schreibe mindestens 6 Sätze.")).toContain("Z9#writing:model-answer-sentences");
    expect(withTask("Write a short message to a friend.")).not.toContain("Z9#writing:model-answer-sentences"); // no number named: nothing to check
  });

  it("sentences are counted by their end marks; a spelled name or a dash dialogue is not split further", () => {
    expect(sentenceCount("Guten Morgen, ich heiße Anna. Ich buchstabiere: A, N, N, A. Wie heißt du? – Ich heiße Jonas: J, O, N, A, S. Tschüs!")).toBe(5);
    expect(sentencesAsked("Write 5 short sentences. Greet a person.")).toEqual([5, 5]);
    expect(sentencesAsked("Introduce yourself in three to five simple sentences.")).toEqual([3, 5]);
    expect(sentencesAsked("Schreiben Sie 2 bis 3 kurze Sätze.")).toEqual([2, 3]);
    expect(sentencesAsked("Write a message of about 40 words.")).toBeNull();
  });

  it("dictation sentences stay short at low levels", () => {
    const issues = lint((l) => {
      const d = l.exercises.items.find((q) => q.type === "dictation")!;
      d.answer = "Ich trinke gern Kaffee und esse dazu ein Brot mit Butter.";
    });
    expect(issues.some((i) => i.rule === "dictation-length")).toBe(true);
  });
});

describe("instruction language", () => {
  it("measures the share of German function words, and says nothing when there is too little text", () => {
    expect(germanShare("The verb is the second word and you do not move it to the end of the sentence.")).toBe(0);
    expect(germanShare("Das Verb steht immer an zweiter Stelle und du darfst es nicht ans Ende stellen, auch wenn der Satz lang ist.")).toBeGreaterThan(0.8);
    expect(germanShare("Short.")).toBeNull();
  });

  it("English explanations are fine at zero, a warning at B2 (which is German only)", () => {
    expect(lint(() => {}, "zero").filter((i) => i.rule === "instruction-language")).toEqual([]);
    const b2 = lint(() => {}, "B2").filter((i) => i.rule === "instruction-language");
    expect(b2.length).toBeGreaterThan(0);
    expect(b2[0].message).toMatch(/German only/);
  });

  it("German explanations at zero are flagged", () => {
    const issues = lint((l) => (l.grammar.intro.explanation = ["Das Verb steht immer an zweiter Stelle und du darfst es nicht ans Ende des Satzes stellen, auch wenn der Satz lang ist."]));
    expect(ruleOf(issues)).toContain("Z9#grammar.intro:instruction-language");
  });
});

describe("the lesson hangs together", () => {
  it("a reading text or dialogue that uses none of the lesson's words is flagged", () => {
    const issues = lint((l) => {
      l.reading.passage.text = "Der Hund läuft schnell durch den großen Park und spielt dort mit dem kleinen Ball am Morgen.";
    });
    expect(ruleOf(issues)).toContain("Z9#reading.passage:reading-vocabulary");
  });
});

describe("items", () => {
  it("cards: article left in the word, noun capitals, plural and verb-forms lines, the example uses the word", () => {
    const issues = lint((l) => {
      l.vocabulary.words[0].de = "der Kaffee";
      l.vocabulary.words[1].de = "tee";
      l.vocabulary.words[2].plural = null;
      l.vocabulary.words[3].plural = "Milchs";
      Object.assign(l.vocabulary.words[4], { article: null, en: "to drink", de: "trinken", plural: null, example: "Ich trinke Tee." });
      l.vocabulary.words[5].example = "Hier ist es schön";
    });
    expect(ruleOf(issues)).toEqual(expect.arrayContaining(["Z9#vocabulary.w01:article-in-de", "Z9#vocabulary.w02:noun-capital", "Z9#vocabulary.w03:plural-missing", "Z9#vocabulary.w04:plural-format", "Z9#vocabulary.w05:verb-forms", "Z9#vocabulary.w06:example-word", "Z9#vocabulary.w06:example-punctuation"]));
  });

  it("the same word twice is an error on the second", () => {
    expect(ruleOf(lint((l) => (l.vocabulary.words[3].de = "kaffee")))).toContain("Z9#vocabulary.w04:duplicate-word");
  });

  it("questions in any part: options, gaps, scrambled sentences, article answers", () => {
    const issues = lint((l) => {
      l.exercises.items[0].prompt = "Ich trinke Kaffee."; // gap fill without a gap
      l.exercises.items[6].distractors = ["a"]; // multiple choice with one wrong option
      const ordering = l.exercises.items.find((q) => q.type === "ordering")!;
      ordering.prompt = "Kaffee / ich";
      l.reading.questions[0].distractors = ["coffee", "tea"]; // a wrong option equals the answer
      l.exam.grammar_vocab[1].distractors = ["x", "X", "y"]; // not distinct
    });
    const rules = ruleOf(issues);
    expect(rules).toEqual(expect.arrayContaining(["Z9#exercises.01:gap-missing", "Z9#exercises.07:mc-options", "Z9#reading.q1:distractor-is-answer", "Z9#exam.gv2:distractors-distinct"]));
    expect(issues.some((i) => i.rule === "ordering-words")).toBe(true);
  });

  it("a trap whose wrong and right versions are the same is an error", () => {
    expect(ruleOf(lint((l) => (l.grammar.traps[0].wrong = l.grammar.traps[0].right)))).toContain("Z9#grammar.trap1:trap-same");
  });

  it("errorIds lists items with errors, not warnings", () => {
    const issues = lint((l) => {
      l.vocabulary.words[1].example = "Hier ist es schön"; // warnings only
      l.vocabulary.words[2].de = "brot"; // error
    });
    const ids = errorIds(issues);
    expect(ids.has("Z9#vocabulary.w03")).toBe(true);
    expect(ids.has("Z9#vocabulary.w02")).toBe(false);
  });
});

describe("accepted answers", () => {
  const typing = (l: Lesson) => l.exercises.items.find((q) => q.type === "typing")!;
  const ordering = (l: Lesson) => l.exercises.items.find((q) => q.type === "ordering")!;
  it("are fine on typing, ordering and dictation questions", () => {
    expect(lint((l) => (typing(l).accepted_answers = ["Ich trinke den Kaffee."]))).toEqual([]);
    expect(lint((l) => (ordering(l).accepted_answers = [ordering(l).prompt.split(" / ").reverse().join(" ") + "."]))).toEqual([]);
  });
  it("are an error on a choice question", () => {
    const issues = lint((l) => (l.exercises.items.find((q) => q.type === "multiple_choice")!.accepted_answers = ["x"]));
    expect(issues.map((i) => i.rule)).toContain("accepted-type");
  });
  it("must differ from the answer once case, punctuation and ß/ss are ignored", () => {
    expect(lint((l) => (typing(l).accepted_answers = [typing(l).answer.toLowerCase().replace(".", "")])).map((i) => i.rule)).toContain("accepted-distinct");
    expect(lint((l) => (typing(l).accepted_answers = ["Mein Name ist Jonas.", "mein name ist jonas"])).map((i) => i.rule)).toContain("accepted-distinct");
  });
  it("a dictation does not accept digits for number words (a warning for the reviewer)", () => {
    const dictation = (l: Lesson) => l.exercises.items.find((q) => q.type === "dictation")!;
    const issues = lint((l) => ((dictation(l).answer = "Ich bin dreißig Jahre alt."), (dictation(l).accepted_answers = ["Ich bin 30 Jahre alt."])));
    expect(issues.map((i) => `${i.level}:${i.rule}`)).toEqual(["warn:dictation-digits"]);
  });
  it("an accepted order uses exactly the words of the question", () => {
    expect(lint((l) => (ordering(l).accepted_answers = ["Ich trinke Wasser."])).map((i) => i.rule)).toContain("accepted-ordering-words");
  });
});

describe("the warm-up", () => {
  const lintFirst = (mutate: (l: Lesson) => void) => {
    const l = validLesson();
    mutate(l);
    return lintLesson("Z1", "zero", l, { first: true });
  };
  const points = ["say the letters", "spell your name", "greet people"];
  it("the first lesson has a preview and no questions", () => {
    expect(lintFirst((l) => ((l.warmup.preview.points = points), (l.warmup.items = [])))).toEqual([]);
  });
  it("the first lesson without a preview, or with questions, is an error", () => {
    expect(lintFirst(() => {}).map((i) => i.rule)).toEqual(expect.arrayContaining(["warmup-preview", "warmup-count"]));
    expect(lintFirst((l) => (l.warmup.preview.points = points)).map((i) => i.rule)).toEqual(["warmup-count"]);
  });
  it("every other lesson has three questions and no preview", () => {
    expect(lint((l) => (l.warmup.preview.points = points)).map((i) => i.rule)).toEqual(["warmup-preview"]);
  });
});

describe("support tables", () => {
  it("must have one cell per header in every row", () => {
    const issues = lint((l) => (l.grammar.tables = [{ title: "Alphabet", headers: ["Letter", "Name"], rows: [["A", "ah"], ["B"]] }]));
    expect(ruleOf(issues)).toEqual(["Z9#grammar.tbl1:table-shape"]);
    expect(lint((l) => (l.grammar.tables = [{ title: "Alphabet", headers: ["Letter", "Name"], rows: [["A", "ah"], ["B", "beh"]] }]))).toEqual([]);
  });
  it("at most three", () => {
    const t = { title: "T", headers: ["a"], rows: [["x"]] };
    expect(lint((l) => (l.grammar.tables = [t, t, t, t])).map((i) => i.rule)).toContain("table-count");
  });
});

describe("the day exam is fresh", () => {
  it("an exam item that repeats an exercise (same filled sentence) is an error", () => {
    const issues = lint((l) => (l.exam.grammar_vocab[0] = { ...l.exercises.items[0] }));
    expect(ruleOf(issues)).toEqual(["Z9#exam.gv1:exam-fresh"]);
  });
  it("so is one that repeats a warm-up item, even with a different gap prompt", () => {
    const issues = lint((l) => (l.exam.grammar_vocab[0] = { ...l.warmup.items[0], prompt: l.warmup.items[0].prompt.trim() + "  ", distractors: ["x", "y"] }));
    expect(ruleOf(issues)).toEqual(["Z9#exam.gv1:exam-fresh"]);
  });
  it("a dictation or ordering item is the same when its answer sentence is the same (case and punctuation ignored)", () => {
    const dictation = (l: Lesson) => l.exercises.items.find((q) => q.type === "dictation")!;
    const issues = lint((l) => (l.exam.grammar_vocab[1] = { ...dictation(l), answer: dictation(l).answer.toLowerCase().replace(".", "!") }));
    expect(ruleOf(issues)).toEqual(["Z9#exam.gv2:exam-fresh"]);
  });
  it("the exam reading text may not reuse a sentence of the lesson's reading text", () => {
    const issues = lint((l) => (l.exam.reading.passage.text = `Neuer Satz hier. ${l.reading.passage.text.split(". ")[1]}.`));
    expect(ruleOf(issues)).toEqual(["Z9#exam.reading.passage:exam-fresh"]);
  });
  it("short formulaic sentences may be shared (a lesson at A1 and its exam cannot avoid “Das ist Anna.”)", () => {
    expect(lint((l) => (l.exam.reading.passage.text = "Das ist Anna. Anna ist im Café."))).toEqual([]);
  });
  it("different items are fine", () => {
    expect(lint(() => {})).toEqual([]);
  });
});

describe("known traps are flagged for the reviewer (a warning, not an error)", () => {
  it("“Ich bin gut” outside a trap", () => {
    const issues = lint((l) => (l.speaking.drill[0].target = "Ich bin gut."));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ level: "warn", rule: "trap-ich-bin-gut" });
  });
  it("but not inside a trap that marks it as wrong", () => {
    expect(lint((l) => (l.grammar.traps[0] = { wrong: "Ich bin gut.", right: "Mir geht es gut.", why: "Ich bin gut means I am good at something." }))).toEqual([]);
  });
});
