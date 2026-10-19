-- Slice 1: Me -> Send feedback.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  message text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index feedback_user_id_idx on public.feedback (user_id);

alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;
grant select, insert on public.feedback to authenticated;
grant all on public.feedback to service_role;

create policy "feedback_select_own" on public.feedback
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "feedback_insert_own" on public.feedback
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "feedback_require_aal2" on public.feedback
  as restrictive
  for all to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2');
