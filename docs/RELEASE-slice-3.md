# Release plan: slice 3 (lesson content, card unlock, Learn tab) → production

**Status: written, NOT run. Nothing in this file has touched the hosted database or Vercel. Each step waits for Raghav's explicit go.**
**Progress log:** (a) backup done 23 Oct 2026 (schema 20 KB with 9 tables and 12 policies, data 113 KB, auth 15 KB; profiles and cards present; a3 query results saved). The project is on the **Supabase Free plan, which has no automatic backups**, so this manual dump is the backup for the release. (b) re-checked 23 Oct (see b). Next: c.

Branch `slice-3-curriculum`, PR #12. Run the steps in this order, one at a time, and stop at the first surprise (each step says what "surprise" means).

## What changes in production
- **Database**: four migrations (all additive, see step b): the lesson content tables (plan, 14 lesson parts, card templates, question bank, publications), `cards.template_id` + `cards.user_edited`, `profiles.deck_unlocked_seq`, and the `publish_lesson` function (service role only).
- **Content**: the reviewed lessons of run `z1-b1` (data, published by script).
- **App**: the Learn tab and lesson page, Home's button opens Learn, and the **unlock**: the first time a learner opens the app after the deploy, the cards of every published lesson up to their current lesson are copied into their deck (earlier than their start lesson: as already seen, spread over days; their start lesson and later: new).

## Before you start
1. PR #12: CI green (lint, unit tests, build, database tests). Review the diff once.
2. Content is final: the re-review of the corrected items is collected, `npm run content -- build --run z1-b1` shows which lessons are publishable, and Raghav has said which ones go live. **Decision (23 Oct): go live with the 24 lessons that are publishable now** (Z1–Z9, W1.1–W1.3, W2.1–W2.4, W3.1, W3.3–W3.5, W4.1–W4.4; `publish-payloads.json` holds exactly these). W1.4, W1.5, Z10, W2.5, W3.2 and W4.5 are published later, with the same `publish` command, when their re-checks pass (publishing is safe to repeat). `npm run content -- check --run z1-b1` has no error for them.
3. Create `.env.hosted` (git-ignored, never committed or pasted into chat) with exactly these two lines, from the Supabase dashboard (Project settings → API):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<the service role key>
   ```
   The scripts below read `.env.local` first and `.env.hosted` second (the later file wins), so `.env.local` keeps pointing at your local stack. The scripts print `Database: <host> (REMOTE)` and refuse a hosted database without `--yes`.
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
Expect `Database: <host> (REMOTE)` and `Upserted 131 sessions (90 lessons)`. Safe to repeat.

## e) Publish `z1-b1`
```bash
node --env-file=.env.local --env-file=.env.hosted --no-warnings scripts/content.mts build --run z1-b1
node --env-file=.env.local --env-file=.env.hosted --no-warnings scripts/content.mts publish --run z1-b1 --yes
```
Expect one `Published <code>: 23 cards, 42 questions, 14 parts.` line per lesson (Z1 has 25 cards and 39 questions) and no refusal. In the SQL editor: `select count(*) from public.lesson_publications;` = the number of lessons you decided to publish. Nobody sees the lessons yet: the current app has no screen for them. Publishing again later (after a correction) is safe: it updates in place.

## f) Merge PR #12 and deploy
1. CI green, then merge (squash or merge commit, as usual); Vercel deploys `main`.
2. Smoke test on the live site, signed in with 2FA: Home shows "Continue" and opens Learn; Learn shows today's lesson (or "not ready yet" for an unpublished one); "Read today's lesson" opens it; Cards opens and a review syncs.
3. **What happens to members on their first visit:** the app copies the cards of the published lessons up to their current lesson into their deck. Check `select count(*) from cards where source = 'lesson'` after a few minutes. **Raghav is the exception:** the admin's deck is not unlocked until the seed deck is imported (step g), so his own cards come first (about a quarter of his seed words are also lesson words).

**Surprise = roll back the deploy** (see below): errors on Home or Cards after the deploy, or lesson cards appearing for Raghav before he imports.

## g) Import the seed deck (Raghav)
Sign in as the admin, Cards → "Import seed deck", once. It imports his 213 cards (skipping words already in his deck), moves him to Day 11 · Z9 (never backwards) and unlocks the published lessons up to Z9. The button reports the counts. Z9 itself needs to be published for its text to open on Learn.

## Rollback
Everything here is additive, so the usual rollback is to undo the **code** and leave the schema in place.
- **After f (bad deploy):** in Vercel, Deployments → the previous production deployment → "Promote to Production" (instant). The migrations stay: today's code works with them (b). Lesson cards already copied into decks stay too and are harmless to the old code.
- **Hide the lessons** (after e, no code change needed): `delete from public.lesson_publications;` members then see no lesson parts (row-level security). Publishing again restores them.
- **Remove the lesson cards** (only if they must go; this deletes learners' progress on those cards): `delete from public.cards where source = 'lesson';` (their `card_srs` and `reviews` go with them), then `update public.profiles set deck_unlocked_seq = null;`.
- **Undo Raghav's pointer:** `update public.profiles set session_seq = <old>, day_count = <old>, start_code = <old> where user_id = '<his id>';` with the values written down in a3. His seed cards can stay (importing again is a no-op).
- **Remove the schema** (last resort, only with the data dump from a at hand): drop the new tables and columns in reverse order (`drop function public.publish_lesson…; drop table public.lesson_publications, public.lesson_parts, public.question_bank, public.card_templates, public.curriculum_sessions; alter table public.cards drop column template_id, drop column user_edited; alter table public.profiles drop column deck_unlocked_seq;` and delete the four rows from `supabase_migrations.schema_migrations`). Dropping loses all published lessons, which can be published again from the repo.
- **Full restore:** the backup from a1 (point-in-time if available), or the dump from a2. This also rewinds every member's progress since the backup, so use it only if the data itself is damaged.

## After
Update `CLAUDE.md` "Where we are" and the BLUEPRINT status line; note the date of the release and the number of lessons published.
