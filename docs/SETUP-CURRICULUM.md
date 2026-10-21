# Slice 3 (Curriculum content): how to run it

The lesson plan, the word cards and the test questions for Z1 → B1 are produced in two paid passes and inserted only after you have looked at them. Nothing here runs in the app or on Vercel: it is a set of scripts you run on your own machine.

## The Anthropic key
Put `ANTHROPIC_API_KEY=sk-ant-…` in `.env.local` **only**. Never in Vercel, never in a `NEXT_PUBLIC_` variable. CI builds with a canary key and fails if it (or anything key-shaped) ends up in the client bundle; `npm run check:bundle` does the same check locally after `npm run build`.

(Slice 4, Buddy's lessons, will need a key on the server. That one is separate: create a second key for it, scoped to the `deutschmitbuddy` workspace.)

## The flow
Every command takes `--run <name>`; files go to `data/generated/<name>/`.

```bash
# 0. once per database: the lesson plan (safe to repeat)
npm run seed:curriculum

# 1. cost estimate for the Sonnet pass (nothing is paid)
npm run content -- estimate --run sample-z1-z3 --stage generate --lessons Z1,Z2,Z3
#    after "yes": the paid Batch run (the id binds the approval to exactly these requests)
npm run content -- run --run sample-z1-z3 --stage generate --approve <estimate id>

# 2. estimate and run the Opus correctness pass
npm run content -- estimate --run sample-z1-z3 --stage review
npm run content -- run --run sample-z1-z3 --stage review --approve <estimate id>

# 3. merge both passes into the review file, then look at it
npm run content -- build --run sample-z1-z3
npm run dev    # then open /design/content?run=sample-z1-z3

# 4. insert what was approved (ok and fixed items only)
npm run content -- insert --run sample-z1-z3
```

Add `--exact` to an estimate to count tokens with the API (free) instead of estimating them. Writing to a hosted database needs `--yes`; the scripts print which database they are talking to first.

## Cost rules
- Every paid pass prints an estimate first: requests, tokens, expected cost and the **worst case** (every request using its whole token limit), in euros at `$1 = €0.95` (override with `USD_TO_EUR`).
- A pass whose worst case is above **€10** is refused, even with an approval.
- A pass is resumable: the batch id is saved before waiting, so a restart polls the same batch and never submits (or pays) twice.
- The actual cost is written to `<stage>.report.json` next to the output.

## What the review file says
Opus gives every card and question one verdict:
- **ok**: nothing to change.
- **fixed**: it corrected a clear error; the file shows the original, the corrected item and why.
- **needs-human**: it was unsure, or the correction still failed an automatic check. These are never inserted; they wait for you.

A free automatic check (counts, missing gaps, scrambled sentences that don't match their answer, articles left inside the word, …) runs before and after Opus. An "ok" from Opus is not believed if an automatic check fails.

Files: `generate.raw.json`, `review.raw.json`, `review.json` (everything, with reasons), `review.md` (readable summary), `approved.json` (what gets inserted), `needs-human.json`.
