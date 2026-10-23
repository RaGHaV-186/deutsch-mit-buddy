# Release plan: slice 3 (lesson content, card unlock, Learn tab) → production

**Status: COMPLETE on 23 Oct 2026 (steps a to g, and e2 for the last six lessons), each step run after Raghav's explicit "next".** Keep this file as the template for the next release (tranches 2 to 4): the steps, the checks and the lessons learned below hold for any release that adds migrations or content.
**Progress log:** (a) backup done (schema 20 KB, data 113 KB, auth 15 KB, valid; a3 results saved). (b) all four migrations additive, main's 54 DB tests pass against the migrated schema. (c) `db push` done (9 migrations, counts unchanged: cards 202, profiles 1). (d) 131 plan rows seeded. (e) 24 lessons published, every verify number matched (24 publications, 336 parts, 554 templates = 432 words + 122 phrases, 1005 questions). (f) PR #12 merged with a merge commit (`bf0b801`, parents `f366725` and `e6bec61`), tagged `slice-3`; Vercel deployed production from it. (g) "Import seed deck" ran; Home shows Day 11 · Z9 and Learn works (reported by Raghav). `.env.hosted` was deleted afterwards. (e2) the six held-back lessons (Z10, W1.4, W1.5, W2.5, W3.2, W4.5) passed their re-checks and were published in a second run of step e; every verify number matched (30 publications, 420 parts, 0 unreviewed, 692 templates = 540 words + 152 phrases, 1257 questions; cards 302 and lesson cards 100 unchanged, profiles 1); `.env.hosted` deleted afterwards. **RELEASE COMPLETE 23 Oct 2026: all 30 lessons of tranche 1 (Z1 to W4.5) are live.**

Branch `slice-3-curriculum`, PR #12. Run the steps in this order, one at a time, and stop at the first surprise (each step says what "surprise" means).

## What changes in production
- **Database**: four migrations (all additive, see step b): the lesson content tables (plan, 14 lesson parts, card templates, question bank, publications), `cards.template_id` + `cards.user_edited`, `profiles.deck_unlocked_seq`, and the `publish_lesson` function (service role only).
- **Content**: the reviewed lessons of run `z1-b1` (data, published by script).
- **App**: the Learn tab and lesson page, Home's button opens Learn, and the **unlock**: the first time a learner opens the app after the deploy, the cards of every published lesson up to their current lesson are copied into their deck (earlier than their start lesson: as already seen, spread over days; their start lesson and later: new).

## Before you start
1. PR #12: CI green (lint, unit tests, build, database tests). Review the diff once.
2. Content is final: the re-review of the corrected items is collected, `npm run content -- build --run z1-b1` shows which lessons are publishable, and Raghav has said which ones go live. **Decision (23 Oct): go live with the 24 lessons that are publishable now** (Z1–Z9, W1.1–W1.3, W2.1–W2.4, W3.1, W3.3–W3.5, W4.1–W4.4; `publish-payloads.json` holds exactly these). W1.4, W1.5, Z10, W2.5, W3.2 and W4.5 are published later, with the same `publish` command, when their re-checks pass (publishing is safe to repeat). `npm run content -- check --run z1-b1` has no error for them.
3. Create `.env.hosted` (git-ignored, never committed or pasted into chat) with exactly these two lines, from the Supabase dashboard (Project settings → API → the `service_role` secret key):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<the service role key>
   ```
   Without the key showing on screen or landing in the shell history, in **zsh** (the macOS default shell; `read -s -p` is bash syntax and fails in zsh with "no coprocess"; zsh puts the prompt after a `?`):
   ```zsh
   read -s "KEY?Paste the service role key, then Enter: "; echo
   printf 'NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co\nSUPABASE_SERVICE_ROLE_KEY=%s\n' "$KEY" > .env.hosted
   unset KEY; chmod 600 .env.hosted
   git check-ignore -v .env.hosted     # must print the .gitignore rule; nothing printed = stop
   ```
   The scripts below read `.env.local` first and `.env.hosted` second (the later file wins), so `.env.local` keeps pointing at your local stack. The scripts print `Database: <host> (REMOTE)` and refuse a hosted database without `--yes`. **Delete `.env.hosted` when the release is finished.**
4. `npm run test:rls` refuses to run unless `SUPABASE_URL` is localhost or 127.0.0.1 (and it no longer touches published lessons or any account that is not an `rls-…@example.test` test user). Never point it anywhere else.

## a) Backup (and write down what you will need to undo)
1. **Free plan: there are no automatic backups** (Dashboard → Database → Backups shows none), so a manual dump is the only backup. **Run one before every release.** Point-in-time recovery and daily backups need the Pro plan.
2. Run `npm run backup` in Terminal (Docker running, project linked with `npx supabase link`). It writes three dumps, never into the repo, owner-only (chmod 600), and refuses to overwrite one:
   ```
   ~/backups/deutschmitbuddy/schema-<date>.sql   the tables, policies, functions
   ~/backups/deutschmitbuddy/data-<date>.sql     the rows (profiles, cards, reviews, …)
   ~/backups/deutschmitbuddy/auth-<date>.sql     the accounts, with password hashes: keep private
   ```
   The CLI asks for the database password: type it at the prompt (Dashboard → Project settings → Database if you need to reset it); it is never printed or saved. The script then checks each file (not empty, has the profiles/cards tables, not cut off) and prints `ok` or `PROBLEM`. Check by hand as well: `ls -lh ~/backups/deutschmitbuddy/`, and that your own user id (from `select user_id from public.profiles where role = 'admin';`) appears in the data file (`grep -c '<user id>' data-<date>.sql`). Never commit these files.
3. In the dashboard SQL editor, copy these results somewhere safe (they are what step "Rollback" needs):
   ```sql
   select user_id, role, start_code, session_seq, day_count from public.profiles;
   select count(*) as cards, count(*) filter (where source = 'seed') as seed_cards from public.cards;
   select count(*) as members from public.profiles where onboarded_at is not null;
   ```
4. Read-only: `npx supabase migration list --linked`. Expect the five migrations of slices 1 and 2 applied (`20261019100000` to `20261020100000`) and **exactly four pending: `20261021100000`, `20261022100000`, `20261023100000`, `20261023100100`**. If fewer than four are pending, STOP (see below).

**Surprise = stop:** an empty or tiny dump, no recent backup, migrations applied that you do not recognise, or **fewer than four pending**: pushing only three would leave the old `publish_lesson` and the old unique index on `question_bank` (prompt-based), and every lesson fails to publish (all of them contain several dictation questions with the same prompt: "ON CONFLICT DO UPDATE command cannot affect row a second time"). Check `ls supabase/migrations | wc -l` is 9 and `git log -1 --format=%h` matches the PR head before pushing.

## b) Confirm the migrations are additive and today's production code keeps working
The four new migrations (everything between `origin/main` and this branch):

| Migration | What it does | Touches existing production data? |
|---|---|---|
| `20261021100000_curriculum_content` | creates `curriculum_sessions`, `card_templates`, `question_bank`, `lesson_parts`, `lesson_publications`, the publish check and `publish_lesson`; adds nullable `profiles.deck_unlocked_seq`; adds a partial unique index on `cards` (only rows with `source = 'lesson'`, none exist) | No rows read or changed |
| `20261022100000_content_accepted_answers` | adds a column to the new `question_bank`; replaces two of the new functions | No |
| `20261023100000_lesson_card_links` | adds `cards.template_id` (nullable) and `cards.user_edited` (not null, default false) and two indexes; swaps a unique index on the new `card_templates`; replaces `publish_lesson` | Only adds columns/indexes to `cards`: existing rows get `false` / `null` |
| `20261023100100_question_slots` | swaps a unique index on the new `question_bank`; replaces `publish_lesson` | No |

Checked on 23 Oct 2026, twice (when the plan was written and again right before step c, with `origin/main` unchanged at `f366725`), and worth repeating if the migrations change:
- A scan of the four files for `drop`, `alter`, `truncate`, `delete`, `update`, `rename`: `alter table … add column` and `enable row level security` on new tables; two `drop index` statements, both on indexes that the same release creates (on new tables); `delete`/`update` appear only inside the body of `publish_lesson`, which runs only when a lesson is published, by the service role.
- Today's production code (`origin/main`) was run against the migrated database: its own database tests (7 files, 54 tests: accounts, 2FA, member cap, feedback, flashcards, sync, server-only tables) all pass. Repeat with:
  ```bash
  git worktree add --detach /tmp/main-wt origin/main && ln -s "$PWD/node_modules" /tmp/main-wt/node_modules
  (cd /tmp/main-wt && npx vitest run --project rls)     # local stack only, with the new migrations applied
  git worktree remove --force /tmp/main-wt
  ```
- Why the old code is safe: it names the columns it reads (no `select *` on `cards` or `profiles`) and inserts cards without the new columns, which have defaults; new tables are only readable by signed-in, two-factor members and only for published lessons.
- Locks: adding `cards.user_edited` (constant default) is a metadata change; the two new indexes on `cards` take a short write lock on a table with a few hundred rows.

**Surprise = stop:** a migration that is not in the table above, a failing old-code test, or a `drop`/`alter` on an existing production table.

## c) Push the migrations
```bash
npx supabase db push --linked --dry-run     # lists what would run: exactly the pending ones from a4
npx supabase db push --linked
npx supabase migration list --linked        # all nine applied
```
Then, in the SQL editor: `select count(*) from public.cards;` equals the number from a3, and `select count(*) from public.profiles;` is unchanged.
Production code keeps running during and after this step (that is what b proves). **Do not continue to d until this is clean.**

## d) Seed the lesson plan
```bash
node --env-file=.env.local --env-file=.env.hosted --no-warnings scripts/seed-curriculum.mts --yes
```
Expect `Database: <host> (REMOTE)` and `Upserted 131 sessions (90 lessons). The table now holds 131.` Safe to repeat. **Done 23 Oct 2026: 131 sessions on the hosted database.**

Verify (each query runs on its own). A lesson's position (`seq`) is its index in the whole plan, which also holds review and test days (R1, T1, Saturdays, …), so it is not the lesson number: **Z9 is seq 10 (Day 11)**, and Z7 is seq 8. The code always looks positions up by lesson code (`indexOfCode`, Raghav's pointer comes from `SEED_PROFILE.next_code`), never from a number; the only literal is `seq = 0`, the very first session (Z1), which has no warm-up questions.
```sql
select count(*) from public.curriculum_sessions;                       -- 131
select count(*) from public.curriculum_sessions where kind = 'lesson'; -- 90
select seq from public.curriculum_sessions where code = 'Z1';          -- 0
select seq from public.curriculum_sessions where code = 'Z9';          -- 10
```

## e) Publish the 24 lessons
Publishes exactly the lessons in `data/generated/z1-b1/publish-payloads.json` (built from the review file; only lessons without an open item are in it). Run it from the repo folder in zsh:
```bash
cd ~/code/deutsch-mit-buddy
node --env-file=.env.local --env-file=.env.hosted --no-warnings scripts/content.mts publish --run z1-b1 --yes
```
Expect `Database: <host> (REMOTE)` and then one line per lesson, 24 in all, in this order (Z9 comes last): `Published Z1: 25 cards, 39 questions, 14 parts.` for Z1 and `Published <code>: 23 cards, 42 questions, 14 parts.` for each of the other 23 (Z2 to Z8, W1.1 to W4.4 as listed above, then Z9). A line like `<code> was refused by the database: …` means that lesson was NOT published (nothing of it was written); stop and paste it. Nobody sees the lessons yet: the current app has no screen for them. Publishing again later (after a correction, or to add the 6 held-back lessons) is safe: it updates in place.

Verify (each runs on its own):
```sql
select count(*) from public.lesson_publications;                                    -- 24
select count(*) from public.lesson_parts;                                           -- 336 (24 x 14)
select count(*) from public.lesson_parts where review_status not in ('ok', 'fixed'); -- 0
select count(*) from public.card_templates;                                         -- 554
select count(*) from public.card_templates where kind = 'word';                     -- 432
select count(*) from public.card_templates where kind = 'say';                      -- 122
select count(*) from public.question_bank;                                          -- 1005
select string_agg(p.session_code, ', ' order by s.seq)
  from public.lesson_publications p join public.curriculum_sessions s on s.code = p.session_code;
  -- Z1, Z2, Z3, Z4, Z5, Z6, Z7, Z8, Z9, W1.1, W1.2, W1.3, W2.1, W2.2, W2.3, W2.4, W3.1, W3.3, W3.4, W3.5, W4.1, W4.2, W4.3, W4.4
select count(*) from public.cards;                                                  -- still 202 (publishing never creates cards)
select count(*) from public.profiles;                                               -- still 1
```
Not published yet, on purpose: Z10, W1.4, W1.5, W2.5, W3.2, W4.5 (their re-checks are still running).

## f) Merge PR #12 and deploy
1. Confirm CI is green on the latest commit of the PR (both `check` runs, both `rls` runs, CodeQL with no open alert, Vercel) and that `origin/main` has not moved. Pushing even a docs commit restarts CI, so check again after the last push. Merge only on Raghav's go for this step.
2. Merge with a merge commit, pinned to the commit that was checked: `gh pr merge 12 --merge --match-head-commit <sha>`; then tag the merge commit: `git tag -a slice-3 <merge sha> -m "…" && git push origin slice-3`. Done 23 Oct: merge commit `bf0b801`, tag `slice-3`.
3. Vercel starts the production deploy by itself when `main` changes. Check it is Ready: the **Vercel** status of the merge commit on GitHub says "Deployment has completed", and in the Vercel dashboard (Deployments) the top row is marked Production and Ready with the merge commit; then open `https://deutschmitbuddy.de/api/health` (expect `"app":"ok"` and `"supabase":"ok"`).
4. **Before anyone opens the live app, run the g0 check below.**
5. Smoke test on a phone, signed in with 2FA: Home shows "Continue" and the right day; Learn opens with today's goal and the card counts; "Read today's lesson" opens the lesson text; Cards opens and a review syncs; old cards keep their own wording.
6. **What happens to members on their first visit:** the app copies the cards of the published lessons up to their current lesson into their deck (in the layout, so it happens on any page). Only 1 profile existed at this release (Raghav), so nobody else was affected. **The admin is held back only while he has no seed cards** (so his own cards come first); Raghav's hosted deck already had the 202 seed cards, so for him the unlock ran on the first page load, before he pressed Import.

**Surprise = roll back the deploy** (see below): errors on Home or Cards after the deploy, or a card count that is far off the number computed in g.

## g) Check the profile, open the app, import the seed deck (Raghav)
**g0, before the first page load after the deploy** (SQL editor):
```sql
select start_code, session_seq, day_count, deck_unlocked_seq from public.profiles;
```
Expect `start_code` = `Z9` or empty, and `session_seq` = 10. The start lesson decides which lesson cards arrive as already seen (spread over days) and which as new: with `Z9` (or empty, then the current lesson counts), Z1 to Z8 are seen and only Z9 is new. If `start_code` is anything else (for example `Z1`), those lessons would arrive as a pile of NEW cards, and fixing it after the first load does not turn them into seen ones. Fix it first: `update public.profiles set start_code = 'Z9' where role = 'admin';`.

**g1, open the live app** signed in as admin. The unlock runs. The numbers below were computed from the data before the release (209 templates for Z1 to Z9, minus 109 he already owns or that repeat):
```sql
select count(*) from public.cards;                                        -- 302 (202 seed + 100 lesson)
select count(*) from public.cards where source = 'lesson';                -- 100
select session_code, count(*) from public.cards where source = 'lesson' group by 1 order by 1;
  -- Z1 19, Z2 10, Z3 8, Z4 8, Z5 12, Z6 8, Z7 13, Z8 11, Z9 11
select count(*) from public.card_srs s join public.cards c on c.id = s.card_id
  where c.source = 'lesson' and s.last_reviewed_at is null;               -- 11 (only the Z9 cards are new)
select start_code, session_seq, day_count, deck_unlocked_seq from public.profiles;  -- Z9, 10, 11, 10
```
**g2, Cards → "Import seed deck", once.** With the seed cards already there it adds no cards ("Imported 0 cards … 202 were already there, 11 repeats skipped. 0 cards of the lessons were added."); it only makes sure the pointer is Day 11 · Z9 (adds "You are on Day 11 · Z9 now." when it had to move it). Z9 itself must be published for its text to open on Learn.

## Lessons learned (23 Oct 2026)
- **`seq` is a plan position, not a day or a lesson number.** The plan holds review and test days (R1, T1, Saturdays, …) between lessons, so Z7 is seq 8 and **Z9 is seq 10 (Day 11)**. I once wrote a verify query with Z9 at seq 8 from a test fixture. Write verify queries by `code`, never by `seq`; the code looks positions up by lesson code (`indexOfCode`), and the only literal is `seq = 0` (the first session, Z1, which has no warm-up questions).
- **The Supabase Free plan has no automatic backups.** The manual dump is the only backup: run `npm run backup` before every release, check it, keep the files outside the repo.
- **zsh is not bash.** `read -s -p "prompt" VAR` fails in zsh ("no coprocess"); use `read -s "VAR?prompt"`. Commands in this file are written for zsh.
- **Check what the unlock will do to the existing user before the first page load.** My plan assumed Raghav's deck had no seed cards, so the "admin waits for the import" rule would protect him; it did not apply because his 202 seed cards already existed. What mattered was his `start_code` (g0). Compute the expected numbers from the real data first.
- **A migration list that looks short is a stop.** Raghav's list first showed 3 pending instead of 4 (a cut-off paste). Pushing three would have left the old unique index on `question_bank` and every lesson would have failed to publish.
- **Pushing a docs commit restarts CI**, so confirm the green state on the final commit, not an earlier one; CodeQL can fail on a PR even when the project's own CI is green.
- **Publishing only some lessons:** the `publish` command publishes everything in the run's `publish-payloads.json` and has no lesson filter. To publish a subset (the six held-back lessons), copy just those payloads into a new run folder (`data/generated/<run>-six/publish-payloads.json`) and run the same command with `--run <run>-six`; delete that folder afterwards. Re-publishing a live lesson is safe (it updates in place) but bumps its `template_version`, so the subset is cleaner.
- **Count what you publish.** Per-lesson card and question counts and the totals (24, 336, 554, 1005) were computed from the payload file before the run, so every verify query had an expected number.
- **Follow-up after the release (done 23 Oct):** the Vercel variable `NEXT_PUBLIC_SITE_URL` was missing (health showed `"siteUrl":"missing"`); it is set to the canonical `https://www.deutschmitbuddy.de` now. See `docs/DOMAIN.md`.

## Rollback
Everything here is additive, so the usual rollback is to undo the **code** and leave the schema in place.
- **After f (bad deploy):** in Vercel, Deployments → the previous production deployment → "Promote to Production" (instant). The migrations stay: today's code works with them (b). Lesson cards already copied into decks stay too and are harmless to the old code.
- **Hide the lessons** (after e, no code change needed): `delete from public.lesson_publications;` members then see no lesson parts (row-level security). Publishing again restores them.
- **Remove the lesson cards** (only if they must go; this deletes learners' progress on those cards): `delete from public.cards where source = 'lesson';` (their `card_srs` and `reviews` go with them), then `update public.profiles set deck_unlocked_seq = null;`.
- **Undo Raghav's pointer:** `update public.profiles set session_seq = <old>, day_count = <old>, start_code = <old> where user_id = '<his id>';` with the values written down in a3. His seed cards can stay (importing again is a no-op).
- **Remove the schema** (last resort, only with the data dump from a at hand): drop the new tables and columns in reverse order (`drop function public.publish_lesson…; drop table public.lesson_publications, public.lesson_parts, public.question_bank, public.card_templates, public.curriculum_sessions; alter table public.cards drop column template_id, drop column user_edited; alter table public.profiles drop column deck_unlocked_seq;` and delete the four rows from `supabase_migrations.schema_migrations`). Dropping loses all published lessons, which can be published again from the repo.
- **Full restore:** the backup from a1 (point-in-time if available), or the dump from a2. This also rewinds every member's progress since the backup, so use it only if the data itself is damaged.

## After
Done 23 Oct 2026: `CLAUDE.md` "Where we are" and the BLUEPRINT status line record the release (30 lessons live, the date, the checks). For the next release (tranches 2 to 4): run `npm run backup` first, repeat steps b to f, and use this file's checks and numbers as the template.
