-- Slice 1: profiles. One row per auth user, created by a trigger on signup.
-- "Automatically expose new tables" is OFF, so every privilege below is explicit.

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 40),
  role text not null default 'member' check (role in ('member', 'admin')),
  start_code text check (start_code is null or char_length(start_code) <= 12),
  session_seq integer not null default 0 check (session_seq >= 0),
  day_count integer not null default 1 check (day_count >= 1),
  onboarded_at timestamptz,
  terms_accepted_at timestamptz,
  voice_on boolean not null default true,
  reminder_time time,
  timezone text not null default 'Europe/Berlin' check (char_length(timezone) <= 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Privileges: members read their own row and edit cosmetic columns only.
-- role, session_seq, day_count, onboarded_at, terms_accepted_at are written by the server (service role).
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, voice_on, reminder_time, timezone) on public.profiles to authenticated;
grant all on public.profiles to service_role;

create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Two-factor is enforced in the database too: a password-only (aal1) session sees nothing.
create policy "profiles_require_aal2" on public.profiles
  as restrictive
  for all to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2');

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Creates the profile when a user signs up. Only a sanitised display name and the
-- terms flag are taken from user-controlled metadata; never the role.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := nullif(btrim(left(coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    ''
  ), 40)), '');

  insert into public.profiles (user_id, display_name, terms_accepted_at)
  values (
    new.id,
    v_name,
    case when new.raw_user_meta_data ->> 'terms_accepted' = 'true' then now() end
  );
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
