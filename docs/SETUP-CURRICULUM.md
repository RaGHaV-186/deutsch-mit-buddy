# Slice 3 (Lesson content): how to run it

Every lesson from Z1 to B1 has the 14 parts of the lesson standard (BLUEPRINT section 1). They are written by Sonnet in four Batch passes (A: teaching parts, B: reading/listening/writing/speaking, C: day exam, D: warm-up/culture/mission/close day), checked item by item by Opus, and published only when nothing is left open. The passes are small because the API refuses structured-output schemas that are too large (each was probed with a real request). Nothing here runs in the app or on Vercel: these are scripts you run on your own machine.

## The Anthropic key
Put `ANTHROPIC_API_KEY=sk-ant-…` in `.env.local` **only**. Never in Vercel, never in a `NEXT_PUBLIC_` variable. CI builds with a canary key and fails if it (or anything key-shaped) ends up in the client bundle; `npm run check:bundle` does the same check locally after `npm run build`.

(Slice 4c, Buddy's live AI, needs a key on the server. Create a second key for that one, scoped to the `deutschmitbuddy` workspace.)

## The flow
Every command takes `--run <name>`; files go to `data/generated/<name>/`.

```bash
# 0. once per database: the lesson plan (safe to repeat)
npm run seed:curriculum

# 1. Sonnet pass A (goal, grammar + tables, exercises, vocabulary, pronunciation): estimate, then the paid run
npm run content -- estimate --run sample-z1-z3 --stage generate-a --lessons Z1,Z2,Z3
npm run content -- run      --run sample-z1-z3 --stage generate-a --approve <estimate id>

# 2. Sonnet passes B, C, D (they see pass A's output, so run A first; B, C and D do not depend on each other)
#    B: reading, listening, writing, speaking   C: the day exam   D: warm-up (reviews the EARLIER lessons), culture, mission, close day
npm run content -- estimate --run sample-z1-z3 --stage generate-b      # same for generate-c and generate-d
npm run content -- run      --run sample-z1-z3 --stage generate-b --approve <estimate id>

# 3a. FREE: the automatic checks on the lessons written so far (counts, exam freshness, answer lists, tables ...)
npm run content -- check    --run sample-z1-z3
#     a lesson with an error is not sent to Opus: write it again (--lessons Z2), or add --allow-lint-errors to let Opus try

# 3b. Opus checks every item of every complete lesson
npm run content -- estimate --run sample-z1-z3 --stage review
npm run content -- run      --run sample-z1-z3 --stage review --approve <estimate id>

# 4. merge everything into the review file, read it, export a lesson as Markdown
npm run content -- build    --run sample-z1-z3
npm run dev                 # then open /design/content?run=sample-z1-z3
npm run content -- markdown --run sample-z1-z3 --lesson Z1 --out ~/Downloads/z1-lesson.md

# 4b. Correcting single items after a review: put the new content of each item in data/generated/<run>/manual-fixes.json
#     as { "Z1#writing": { "reason": "why", "value": { ...the whole item... } } }. A correction replaces that item only (the format is checked),
#     the item's old verdict stops counting, and Opus re-checks ONLY the corrected items (a few cents), then build again.
npm run content -- check    --run sample-z1-z3-v2
npm run content -- estimate --run sample-z1-z3-v2 --stage review --fixes
npm run content -- run      --run sample-z1-z3-v2 --stage review --fixes --approve <estimate id>
npm run content -- build    --run sample-z1-z3-v2

# 5. publish every lesson that has no open item (needs --yes for a hosted database)
npm run content -- publish  --run sample-z1-z3
```

Add `--exact` to an estimate to count tokens with the API (free) instead of estimating them.

## Cost rules
- Every paid pass prints an estimate first: requests, tokens, expected cost and the **worst case** (every request using its whole token limit), in euros at `$1 = €0.95` (override with `USD_TO_EUR`).
- A pass whose worst case is above **€10** is refused, even with an approval. At most about 60 lessons fit in a Sonnet pass and 45 in an Opus pass, so run big batches in tranches (for example Z1 to A1 first, then A2, then B1).
- An approval is tied to the exact requests (the estimate id): change a prompt or a lesson and you need a new estimate.
- A pass is resumable: the batch id is saved before waiting, so a restart polls the same batch and never submits (or pays) twice.
- The actual cost of each pass is written to `<stage>.report.json`.

## What the review file says
Opus gives every item of the lesson (about 93: each card, phrase, exercise, passage, task, exam item ...) one verdict:
- **ok**: nothing to change.
- **fixed**: it corrected a clear error; the file shows the original, the correction and why.
- **needs-human**: it was unsure, or its correction still failed an automatic check.

Free automatic checks run before and after Opus (`check` shows both): counts (15 to 20 words, 5 phrases, 19 exercises of the right mix ...), level bands for reading, listening and writing length, how German the instructions are, broken questions, a writing model answer that meets its own task (at least `min_words` words and the number of sentences the task names), and more. An "ok" from Opus is not believed when an automatic check fails.

**A lesson publishes only when no item needs a human and the lesson as a whole has no errors.** The database enforces it too: `publish_lesson` refuses a lesson unless all 14 parts exist and each passed the review, and a trigger on `lesson_publications` re-checks the counts.

Files: `generate-a.raw.json` to `generate-d.raw.json`, `review.raw.json`, `review.json` (everything, with reasons and the corrected lesson), `review.md` (readable summary), `publish-payloads.json`, `needs-human.json`.

## Where the rules for the writer and the reviewer live
- `src/lib/content/prompts.ts`: the system prompts of the four passes and of the review.
- `src/lib/content/common-traps.ts`: **known mistakes** ("Ich bin gut" for well-being, "Ich bin kalt", bekommen, tsch vs sch, du/Sie, Gute vs Guten ...). The whole list goes to every writer and to the reviewer. Add an entry when a review finds a new one (optionally with a `detect` pattern the free lint looks for).
- `src/lib/content/lesson-notes.ts`: **requirements for one lesson** (for example "Z1 has the alphabet table"). They go into the prompts of the passes they name and the reviewer checks them.
- `src/lib/content/lesson-lint.ts`: the free checks. `src/lib/content/answer-check.ts`: how a learner's answer is checked (used by the lesson player later).

## Answers
Typing, translation, dictation and ordering questions list `accepted_answers` next to `answer` (every other natural, correct answer). Checking ignores case, punctuation and ß/ss; typing/translation still show a gentle note ("Nacht is written with a capital N"); for **dictation** case and ß/ss count as errors. Ordering alternatives must use exactly the question's words.

## The warm-up
Lesson 1 has a preview ("Today you'll learn ...") and no questions. Every other lesson has 3 recall questions on the **earlier** lessons' grammar and words (the last 6 lessons' grammar points; their words come from the same run, so write a whole stretch under one run name). Never on the lesson's own content.

## Publishing, unlocking cards, and corrections (slice 3b)
**Publish** (step 5 above) writes a lesson's 14 parts, its card templates and its question bank in one transaction, and only for lessons without an open item. Against the hosted project, first push the migrations (`npx supabase db push`), seed the plan (`npm run seed:curriculum -- --yes`), then `npm run content -- publish --run z1-b1 --yes`. The local database needs no flag. Run `npm run test:rls` only on a local stack: it deletes every local user AND all published lesson content (publish again afterwards).

**Identity.** A card template is identified by its slot (lesson, kind, position) and a question by its slot (lesson, part, position), never by its words or prompt. So a corrected word or prompt replaces the old row, a slot the new payload no longer has is removed, and dictation questions (which all share one prompt) publish fine.

**Corrections reach every learner.** Publish a corrected lesson again (`build`, then `publish`): the template is updated in place, and every learner's copy of that card (source "lesson", linked by `template_id`) takes the new text. Their schedule (`card_srs`) and reviews are never touched, and a card they edited (`user_edited`) is left alone.

**Unlocking.** A learner's deck gets the cards of every PUBLISHED lesson up to today's lesson (`src/lib/cards/unlock.ts`): at onboarding, in the app layout and on Home and Learn (one shared promise per request, because the layout and the page render in parallel), and in the admin seed import. Lessons before the learner's starting lesson count as already seen and are spread over days; the starting lesson and later ones are new. A card is never added twice: the same kind and German (case ignored) from any source (Raghav's seed deck, an earlier lesson) is skipped. `profiles.deck_unlocked_seq` remembers the highest published lesson already copied, so lessons published later are picked up the next time the learner opens the app.

**Raghav's pointer.** The admin "Import seed deck" button also puts him on Day 11 · Z9 (never backwards) and unlocks the published lessons up to there. Z9 itself needs to be published for the Learn tab to show its text.

**Learn tab.** `/learn` shows today's lesson (goal, grammar, cards, the parts) and `/learn/<code>` reads a published lesson: the teaching parts only. Warm-up questions, exercises and the day exam arrive with the lesson player (slice 4a).
