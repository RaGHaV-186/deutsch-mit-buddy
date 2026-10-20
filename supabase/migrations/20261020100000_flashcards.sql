-- Slice 2: flashcards. A learner's deck (cards), its spaced-repetition state (card_srs) and the review log (reviews).
-- Members can only READ these tables. The sync route and the deck import write with the service role,
-- scoped to the verified user, so the schedule can't be edited from the browser.

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('word', 'say', 'answer')),
  en text not null check (char_length(en) between 1 and 300),
  article text check (article is null or article in ('der', 'die', 'das')),
  de text not null check (char_length(de) between 1 and 300),
  plural text check (plural is null or char_length(plural) <= 200),
  example text check (example is null or char_length(example) <= 300),
  example_en text check (example_en is null or char_length(example_en) <= 300),
  tip text check (tip is null or char_length(tip) <= 300),
  source text not null default 'manual' check (source in ('seed', 'lesson', 'manual')),
  session_code text check (session_code is null or char_length(session_code) <= 12),
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cards_user_id_idx on public.cards (user_id);
-- Makes the seed import idempotent: running it twice can't create duplicates.
create unique index cards_seed_unique on public.cards (user_id, kind, de, en) where source = 'seed';

create trigger cards_set_updated_at
  before update on public.cards
  for each row execute function public.set_updated_at();

create table public.card_srs (
  card_id uuid primary key references public.cards (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  due_at timestamptz not null default now(),
  interval_days double precision not null default 0 check (interval_days >= 0 and interval_days <= 3650),
  ease double precision not null default 2.5 check (ease between 1.3 and 3.0),
  reps integer not null default 0 check (reps >= 0),
  lapses integer not null default 0 check (lapses >= 0),
  last_reviewed_at timestamptz
);
create index card_srs_user_due_idx on public.card_srs (user_id, due_at);

create table public.reviews (
  -- Generated on the device, so a retried sync can't record the same answer twice.
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  grade text not null check (grade in ('again', 'hard', 'good', 'easy')),
  reviewed_at timestamptz not null,
  ms_taken integer not null default 0 check (ms_taken between 0 and 600000),
  -- false when a newer review of the same card had already been applied (latest reviewed_at wins).
  applied boolean not null default true,
  -- true when this was the card's first-ever review; counts against the daily new-card limit.
  was_new boolean not null default false,
  created_at timestamptz not null default now()
);
create index reviews_user_reviewed_idx on public.reviews (user_id, reviewed_at);
create index reviews_card_idx on public.reviews (card_id);
create index reviews_new_idx on public.reviews (user_id, reviewed_at) where was_new;

alter table public.cards enable row level security;
alter table public.card_srs enable row level security;
alter table public.reviews enable row level security;

revoke all on public.cards, public.card_srs, public.reviews from anon, authenticated;
grant select on public.cards, public.card_srs, public.reviews to authenticated;
grant all on public.cards, public.card_srs, public.reviews to service_role;

create policy "cards_select_own" on public.cards
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy "card_srs_select_own" on public.card_srs
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy "reviews_select_own" on public.reviews
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Two-factor is enforced in the database too.
create policy "cards_require_aal2" on public.cards
  as restrictive
  for all to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2');
create policy "card_srs_require_aal2" on public.card_srs
  as restrictive
  for all to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2');
create policy "reviews_require_aal2" on public.reviews
  as restrictive
  for all to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2');
