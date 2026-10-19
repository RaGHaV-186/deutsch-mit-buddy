-- Slice 1: 30-member cap and waitlist.

create table public.app_config (
  key text primary key,
  value jsonb not null
);
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;
grant all on public.app_config to service_role;

insert into public.app_config (key, value) values ('member_cap', '30'::jsonb);

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) between 3 and 254),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index waitlist_email_key on public.waitlist (lower(email));

-- Server only: no policies and no grants for anon/authenticated.
alter table public.waitlist enable row level security;
revoke all on public.waitlist from anon, authenticated;
grant all on public.waitlist to service_role;

-- Seats in use: members (not admins) who confirmed their email, plus unconfirmed
-- sign-ups from the last 2 hours (so abandoned sign-ups can't hold a seat for long).
create function public.member_seats_used()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.profiles p
  join auth.users u on u.id = p.user_id
  where p.role = 'member'
    and (u.email_confirmed_at is not null or u.created_at > now() - interval '2 hours');
$$;

create function public.member_cap()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (value #>> '{}')::integer from public.app_config where key = 'member_cap'), 30);
$$;

create function public.signup_open()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.member_seats_used() < public.member_cap();
$$;

revoke all on function public.member_seats_used() from public, anon, authenticated;
revoke all on function public.member_cap() from public, anon, authenticated;
revoke all on function public.signup_open() from public;
grant execute on function public.member_seats_used() to service_role;
grant execute on function public.member_cap() to service_role;
grant execute on function public.signup_open() to anon, authenticated, service_role;

-- Atomic: concurrent sign-ups queue on an advisory lock until the profile row of the
-- previous one is committed, so the cap can't be overshot.
create function public.enforce_member_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('deutsch-mit-buddy:member-cap'));

  if exists (
    select 1 from public.waitlist w
    where w.approved and lower(w.email) = lower(coalesce(new.email, ''))
  ) then
    return new;
  end if;

  if public.member_seats_used() >= public.member_cap() then
    raise exception 'member_cap_reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_member_cap() from public, anon, authenticated;

create trigger enforce_member_cap
  before insert on auth.users
  for each row execute function public.enforce_member_cap();
