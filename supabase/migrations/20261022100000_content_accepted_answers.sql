-- Questions can list other natural, correct answers (typing, translation, dictation, ordering). The checker ignores case, punctuation and ß/ss,
-- so these are real alternatives only ("Mein Name ist Jonas." next to "Ich heiße Jonas.").
alter table public.question_bank
  add column accepted_answers jsonb not null default '[]'::jsonb
  check (jsonb_typeof(accepted_answers) = 'array' and jsonb_array_length(accepted_answers) <= 8);

-- The first lesson of the course has no warm-up questions (nothing earlier to review): its warm-up is a preview. Every other lesson still needs 3.
create or replace function public.check_lesson_publishable()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_parts text[] := array['goal', 'warmup', 'grammar', 'exercises', 'vocabulary', 'pronunciation', 'reading', 'listening', 'writing', 'speaking', 'culture', 'mission', 'exam', 'closing'];
  v_ok integer;
  v_words integer;
  v_phrases integer;
  v_first boolean;
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
  select coalesce((select seq = 0 from public.curriculum_sessions where code = new.session_code), false) into v_first;
  if (select count(*) from public.question_bank where session_code = new.session_code and part = 'exercises') < 19
     or (not v_first and (select count(*) from public.question_bank where session_code = new.session_code and part = 'warmup') < 3)
     or (select count(*) from public.question_bank where session_code = new.session_code and part = 'reading') < 5
     or (select count(*) from public.question_bank where session_code = new.session_code and part = 'listening') < 5
     or (select count(*) from public.question_bank where session_code = new.session_code and part = 'exam') < 10 then
    raise exception 'Lesson % cannot be published: it has too few exercises or questions', new.session_code using errcode = '23514';
  end if;
  return new;
end;
$$;

-- publish_lesson now carries accepted_answers (missing in an older payload means none).
create or replace function public.publish_lesson(p_code text, p_parts jsonb, p_status jsonb, p_model text, p_cards jsonb, p_questions jsonb)
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

  insert into public.question_bank (session_code, part, position, skill, type, prompt, answer, distractors, accepted_answers, explanation)
    select x.session_code, x.part, x.position, x.skill, x.type, x.prompt, x.answer, x.distractors, coalesce(x.accepted_answers, '[]'::jsonb), x.explanation
    from jsonb_to_recordset(p_questions) as x(session_code text, part text, position integer, skill text, type text, prompt text, answer text, distractors jsonb, accepted_answers jsonb, explanation text)
    on conflict (session_code, part, type, prompt) do update
      set position = excluded.position, skill = excluded.skill, answer = excluded.answer, distractors = excluded.distractors,
          accepted_answers = excluded.accepted_answers, explanation = excluded.explanation;

  insert into public.lesson_publications (session_code) values (p_code);
end;
$$;
revoke all on function public.publish_lesson(text, jsonb, jsonb, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.publish_lesson(text, jsonb, jsonb, text, jsonb, jsonb) to service_role;
