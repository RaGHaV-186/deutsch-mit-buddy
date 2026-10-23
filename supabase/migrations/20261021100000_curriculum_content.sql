-- Slice 3: curriculum content. Shared tables (the same rows for every learner): the lesson plan, the 14 parts of each lesson,
-- the word and phrase cards of each lesson (templates copied into a learner's deck when the lesson unlocks) and the question bank.
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
  -- Which part of the lesson the question belongs to (the day exam has its own items).
  part text not null default 'exercises' check (part in ('warmup', 'exercises', 'reading', 'listening', 'exam')),
  position integer not null default 0 check (position >= 0),
  skill text not null check (skill in ('vocabulary', 'articles', 'grammar', 'word_order', 'translation', 'dictation', 'reading', 'listening')),
  type text not null check (type in ('multiple_choice', 'gap_fill', 'ordering', 'typing', 'dictation')),
  prompt text not null check (char_length(prompt) between 1 and 500),
  answer text not null check (char_length(answer) between 1 and 300),
  -- Wrong options for multiple choice (and gap fill); empty for ordering and typing.
  distractors jsonb not null default '[]'::jsonb check (jsonb_typeof(distractors) = 'array' and jsonb_array_length(distractors) <= 6),
  -- One short sentence on why the answer is right (Buddy uses it when a learner gets it wrong).
  explanation text check (explanation is null or char_length(explanation) <= 400),
  created_at timestamptz not null default now()
);
create unique index question_bank_unique_idx on public.question_bank (session_code, part, type, prompt);
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

-- The lesson standard: every lesson has 14 parts. The parts are stored as validated JSON, one row per part, and a lesson is
-- visible to members only after it is published. Publishing is refused unless all 14 parts exist and every one passed the review
-- (ok or fixed; a needs-human item never gets this far), so an incomplete lesson cannot be inserted.
create table public.lesson_parts (
  session_code text not null check (char_length(session_code) between 1 and 12),
  part text not null check (part in ('goal', 'warmup', 'grammar', 'exercises', 'vocabulary', 'pronunciation', 'reading', 'listening', 'writing', 'speaking', 'culture', 'mission', 'exam', 'closing')),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  review_status text not null check (review_status in ('ok', 'fixed')),
  reviewed_by_model text not null check (char_length(reviewed_by_model) between 1 and 60),
  -- Goes up each time the part is published again after a correction.
  template_version integer not null default 1 check (template_version >= 1),
  updated_at timestamptz not null default now(),
  primary key (session_code, part)
);

create table public.lesson_publications (
  session_code text primary key check (char_length(session_code) between 1 and 12),
  published_at timestamptz not null default now()
);

create function public.check_lesson_publishable()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_parts text[] := array['goal', 'warmup', 'grammar', 'exercises', 'vocabulary', 'pronunciation', 'reading', 'listening', 'writing', 'speaking', 'culture', 'mission', 'exam', 'closing'];
  v_ok integer;
  v_words integer;
  v_phrases integer;
begin
  select count(*) into v_ok from public.lesson_parts
    where session_code = new.session_code and part = any (v_parts) and review_status in ('ok', 'fixed');
  if v_ok <> 14 then
    raise exception 'Lesson % cannot be published: % of 14 parts have passed the review', new.session_code, v_ok using errcode = '23514';
  end if;
  select count(*) into v_words from public.card_templates where session_code = new.session_code and kind = 'word';
  select count(*) into v_phrases from public.card_templates where session_code = new.session_code and kind = 'say';
  if v_words not between 15 and 20 or v_phrases < 5 then
    raise exception 'Lesson % cannot be published: % words and % phrases (needs 15 to 20 words and at least 5 phrases)', new.session_code, v_words, v_phrases using errcode = '23514';
  end if;
  if (select count(*) from public.question_bank where session_code = new.session_code and part = 'exercises') < 19
     or (select count(*) from public.question_bank where session_code = new.session_code and part = 'warmup') < 3
     or (select count(*) from public.question_bank where session_code = new.session_code and part = 'reading') < 5
     or (select count(*) from public.question_bank where session_code = new.session_code and part = 'listening') < 5
     or (select count(*) from public.question_bank where session_code = new.session_code and part = 'exam') < 10 then
    raise exception 'Lesson % cannot be published: it has too few exercises or questions', new.session_code using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger lesson_publications_check
  before insert or update on public.lesson_publications
  for each row execute function public.check_lesson_publishable();

-- Publishes one lesson in a single transaction: its parts, its word and phrase cards, its questions, then the publication
-- (which the trigger above checks). Server only: the service role calls it, members cannot.
create function public.publish_lesson(p_code text, p_parts jsonb, p_status jsonb, p_model text, p_cards jsonb, p_questions jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_part text;
  v_parts text[] := array['goal', 'warmup', 'grammar', 'exercises', 'vocabulary', 'pronunciation', 'reading', 'listening', 'writing', 'speaking', 'culture', 'mission', 'exam', 'closing'];
begin
  if not exists (select 1 from public.curriculum_sessions where code = p_code and kind = 'lesson') then
    raise exception 'Unknown lesson %', p_code using errcode = '23514';
  end if;
  foreach v_part in array v_parts loop
    if not (p_parts ? v_part) or jsonb_typeof(p_parts -> v_part) <> 'object' then
      raise exception 'Lesson % is missing part %', p_code, v_part using errcode = '23514';
    end if;
    if coalesce(p_status ->> v_part, '') not in ('ok', 'fixed') then
      raise exception 'Part % of lesson % has not passed the review', v_part, p_code using errcode = '23514';
    end if;
  end loop;
  if exists (select 1 from jsonb_to_recordset(p_cards) as x(session_code text) where x.session_code is distinct from p_code)
     or exists (select 1 from jsonb_to_recordset(p_questions) as x(session_code text) where x.session_code is distinct from p_code) then
    raise exception 'Cards and questions must all belong to lesson %', p_code using errcode = '23514';
  end if;

  delete from public.lesson_publications where session_code = p_code;
  foreach v_part in array v_parts loop
    insert into public.lesson_parts (session_code, part, content, review_status, reviewed_by_model)
      values (p_code, v_part, p_parts -> v_part, p_status ->> v_part, p_model)
      on conflict (session_code, part) do update
        set content = excluded.content, review_status = excluded.review_status, reviewed_by_model = excluded.reviewed_by_model,
            template_version = public.lesson_parts.template_version + 1, updated_at = now();
  end loop;

  insert into public.card_templates (session_code, kind, tier, position, en, article, de, plural, example, example_en, tip)
    select x.session_code, x.kind, x.tier, x.position, x.en, x.article, x.de, x.plural, x.example, x.example_en, x.tip
    from jsonb_to_recordset(p_cards) as x(session_code text, kind text, tier text, position integer, en text, article text, de text, plural text, example text, example_en text, tip text)
    on conflict (session_code, kind, de, en) do update
      set tier = excluded.tier, position = excluded.position, article = excluded.article, plural = excluded.plural,
          example = excluded.example, example_en = excluded.example_en, tip = excluded.tip;

  insert into public.question_bank (session_code, part, position, skill, type, prompt, answer, distractors, explanation)
    select x.session_code, x.part, x.position, x.skill, x.type, x.prompt, x.answer, x.distractors, x.explanation
    from jsonb_to_recordset(p_questions) as x(session_code text, part text, position integer, skill text, type text, prompt text, answer text, distractors jsonb, explanation text)
    on conflict (session_code, part, type, prompt) do update
      set position = excluded.position, skill = excluded.skill, answer = excluded.answer, distractors = excluded.distractors, explanation = excluded.explanation;

  insert into public.lesson_publications (session_code) values (p_code);
end;
$$;
revoke all on function public.publish_lesson(text, jsonb, jsonb, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.publish_lesson(text, jsonb, jsonb, text, jsonb, jsonb) to service_role;

alter table public.lesson_parts enable row level security;
alter table public.lesson_publications enable row level security;
revoke all on public.lesson_parts, public.lesson_publications from anon, authenticated;
grant select on public.lesson_parts, public.lesson_publications to authenticated;
grant all on public.lesson_parts, public.lesson_publications to service_role;
-- Members see a lesson's parts only once it is published.
create policy "lesson_parts_select_published" on public.lesson_parts for select to authenticated
  using (exists (select 1 from public.lesson_publications p where p.session_code = lesson_parts.session_code));
create policy "lesson_publications_select" on public.lesson_publications for select to authenticated using (true);
create policy "lesson_parts_require_aal2" on public.lesson_parts
  as restrictive for all to authenticated using ((select auth.jwt() ->> 'aal') = 'aal2');
create policy "lesson_publications_require_aal2" on public.lesson_publications
  as restrictive for all to authenticated using ((select auth.jwt() ->> 'aal') = 'aal2');

-- A lesson's card can be copied into a learner's deck only once (the seed import has the same rule for source = 'seed').
create unique index cards_lesson_unique on public.cards (user_id, kind, de, en) where source = 'lesson';

-- How far a learner's deck has been unlocked: the highest curriculum seq whose cards were copied in.
-- Written by the server only (like session_seq): members have no UPDATE right on it.
alter table public.profiles add column deck_unlocked_seq integer check (deck_unlocked_seq is null or deck_unlocked_seq >= 0);
