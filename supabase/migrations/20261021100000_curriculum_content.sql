-- Slice 3: curriculum content. Shared tables (the same rows for every learner): the lesson plan, the word cards of each
-- lesson (templates that are copied into a learner's deck when the lesson unlocks) and the test question bank.
-- Members can only READ them; the seed and insert scripts write with the service role.

create table public.curriculum_sessions (
  -- Position in the plan. Codes like SAT repeat, so seq (not code) is the identity of a session.
  seq integer primary key check (seq >= 0),
  code text not null check (char_length(code) between 1 and 12),
  kind text not null check (kind in ('lesson', 'saturday', 'sunday', 'review', 'test', 'buffer')),
  -- Where the session sits in the plan. B2 and C1 are accepted now so adding them later needs no migration.
  phase text not null check (phase in ('zero', 'A1', 'A2', 'B1', 'exam', 'B2', 'C1')),
  grammar text not null check (char_length(grammar) between 1 and 400),
  theme text not null check (char_length(theme) between 1 and 400),
  goal text check (goal is null or char_length(goal) <= 400),
  -- Words taught in the lesson (10 core + 5 bonus); 0 for weekends, reviews, tests and buffers.
  word_target integer not null default 0 check (word_target between 0 and 40),
  created_at timestamptz not null default now()
);
-- A lesson code identifies one lesson (Z1, W3.2 ...), which card templates and questions refer to.
create unique index curriculum_lesson_code_idx on public.curriculum_sessions (code) where kind = 'lesson';

create table public.card_templates (
  id uuid primary key default gen_random_uuid(),
  session_code text not null check (char_length(session_code) between 1 and 12),
  kind text not null default 'word' check (kind in ('word', 'say', 'answer')),
  -- core words come first; bonus words are the extra five.
  tier text not null default 'core' check (tier in ('core', 'bonus')),
  position integer not null default 0 check (position >= 0),
  en text not null check (char_length(en) between 1 and 300),
  article text check (article is null or article in ('der', 'die', 'das')),
  de text not null check (char_length(de) between 1 and 300),
  plural text check (plural is null or char_length(plural) <= 200),
  example text check (example is null or char_length(example) <= 300),
  example_en text check (example_en is null or char_length(example_en) <= 300),
  tip text check (tip is null or char_length(tip) <= 300),
  -- Filled when Buddy's neural voice arrives (slice 6); the browser voice is used until then.
  audio_url text check (audio_url is null or char_length(audio_url) <= 500),
  created_at timestamptz not null default now()
);
create unique index card_templates_unique_idx on public.card_templates (session_code, kind, de, en);
create index card_templates_session_idx on public.card_templates (session_code, position);

create table public.question_bank (
  id uuid primary key default gen_random_uuid(),
  session_code text not null check (char_length(session_code) between 1 and 12),
  skill text not null check (skill in ('vocabulary', 'articles', 'grammar', 'word_order', 'translation')),
  type text not null check (type in ('multiple_choice', 'gap_fill', 'ordering', 'typing')),
  prompt text not null check (char_length(prompt) between 1 and 500),
  answer text not null check (char_length(answer) between 1 and 300),
  -- Wrong options for multiple choice (and gap fill); empty for ordering and typing.
  distractors jsonb not null default '[]'::jsonb check (jsonb_typeof(distractors) = 'array' and jsonb_array_length(distractors) <= 6),
  -- One short sentence on why the answer is right (Buddy uses it when a learner gets it wrong).
  explanation text check (explanation is null or char_length(explanation) <= 400),
  created_at timestamptz not null default now()
);
create unique index question_bank_unique_idx on public.question_bank (session_code, type, prompt);
create index question_bank_session_idx on public.question_bank (session_code);

alter table public.curriculum_sessions enable row level security;
alter table public.card_templates enable row level security;
alter table public.question_bank enable row level security;

revoke all on public.curriculum_sessions, public.card_templates, public.question_bank from anon, authenticated;
grant select on public.curriculum_sessions, public.card_templates, public.question_bank to authenticated;
grant all on public.curriculum_sessions, public.card_templates, public.question_bank to service_role;

create policy "curriculum_sessions_select" on public.curriculum_sessions for select to authenticated using (true);
create policy "card_templates_select" on public.card_templates for select to authenticated using (true);
create policy "question_bank_select" on public.question_bank for select to authenticated using (true);

-- Two-factor is enforced in the database too (shared content is still only for verified members).
create policy "curriculum_sessions_require_aal2" on public.curriculum_sessions
  as restrictive for all to authenticated using ((select auth.jwt() ->> 'aal') = 'aal2');
create policy "card_templates_require_aal2" on public.card_templates
  as restrictive for all to authenticated using ((select auth.jwt() ->> 'aal') = 'aal2');
create policy "question_bank_require_aal2" on public.question_bank
  as restrictive for all to authenticated using ((select auth.jwt() ->> 'aal') = 'aal2');

-- A lesson's card can be copied into a learner's deck only once (the seed import has the same rule for source = 'seed').
create unique index cards_lesson_unique on public.cards (user_id, kind, de, en) where source = 'lesson';

-- How far a learner's deck has been unlocked: the highest curriculum seq whose cards were copied in.
-- Written by the server only (like session_seq): members have no UPDATE right on it.
alter table public.profiles add column deck_unlocked_seq integer check (deck_unlocked_seq is null or deck_unlocked_seq >= 0);
