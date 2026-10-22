-- Slice 3b: a learner's copy of a lesson card keeps a link to its template, so a correction of the template can reach every copy
-- without touching the learner's schedule (card_srs) or cards they edited themselves.

alter table public.cards
  add column template_id uuid references public.card_templates (id) on delete set null,
  -- Set when the learner changes the card by hand (never done by the server): template corrections skip such a card.
  add column user_edited boolean not null default false;
-- One copy of a template per learner (the same race that unlock hits when two screens load at once).
create unique index cards_template_unique on public.cards (user_id, template_id) where template_id is not null;
create index cards_template_idx on public.cards (template_id) where template_id is not null;

-- A template's identity is its slot in the lesson (kind + position), not its words: a corrected word replaces the template
-- (same id, so every copy follows) instead of adding a second one next to the old one.
drop index public.card_templates_unique_idx;
create unique index card_templates_slot_idx on public.card_templates (session_code, kind, position);

-- publish_lesson again, now with: templates upserted by slot, stale templates and questions of the lesson removed, and the
-- correction passed on to every learner's copy (except edited cards; the schedule is never touched).
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

  -- Card templates: by slot. Slots the new payload no longer has are removed (copies keep their text, template_id becomes null).
  delete from public.card_templates t
    where t.session_code = p_code
      and not exists (select 1 from jsonb_to_recordset(p_cards) as x(kind text, position integer) where x.kind = t.kind and x.position = t.position);
  insert into public.card_templates (session_code, kind, tier, position, en, article, de, plural, example, example_en, tip)
    select x.session_code, x.kind, x.tier, x.position, x.en, x.article, x.de, x.plural, x.example, x.example_en, x.tip
    from jsonb_to_recordset(p_cards) as x(session_code text, kind text, tier text, position integer, en text, article text, de text, plural text, example text, example_en text, tip text)
    on conflict (session_code, kind, position) do update
      set tier = excluded.tier, en = excluded.en, article = excluded.article, de = excluded.de, plural = excluded.plural,
          example = excluded.example, example_en = excluded.example_en, tip = excluded.tip;

  -- Template corrections reach every learner's copy. Only the card's text changes: card_srs and reviews are never touched,
  -- and a card the learner edited (user_edited) is left alone.
  update public.cards c
    set en = t.en, article = t.article, de = t.de, plural = t.plural, example = t.example, example_en = t.example_en, tip = t.tip
    from public.card_templates t
    where c.template_id = t.id and t.session_code = p_code and c.source = 'lesson' and not c.user_edited
      and (c.en, c.article, c.de, c.plural, c.example, c.example_en, c.tip)
          is distinct from (t.en, t.article, t.de, t.plural, t.example, t.example_en, t.tip);

  -- Questions: a corrected question has a new prompt, so the old row would stay behind; remove what the new payload does not have.
  delete from public.question_bank q
    where q.session_code = p_code
      and not exists (select 1 from jsonb_to_recordset(p_questions) as x(part text, type text, prompt text) where x.part = q.part and x.type = q.type and x.prompt = q.prompt);
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
