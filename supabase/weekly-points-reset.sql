-- Pasteable slice: weekly points reset (household_meta + points_history)
-- Safe to re-run on School Compass. Prefer full supabase/schema.sql when unsure.
-- Scoreboard: current = approved awards since household_meta.last_points_reset_at
-- Reset: Pages client on load after Sunday night (Mon 00:00 household TZ).

-- ---------------------------------------------------------------------------
-- Household meta (timezone + last weekly points reset)
-- Singleton row id = 'default'. Pages seeds / advances last_points_reset_at.
-- ---------------------------------------------------------------------------

create table if not exists public.household_meta (
  id text primary key default 'default',
  timezone text not null default 'Europe/London',
  last_points_reset_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.household_meta add column if not exists timezone text not null default 'Europe/London';
alter table public.household_meta add column if not exists last_points_reset_at timestamptz;
alter table public.household_meta add column if not exists updated_at timestamptz not null default now();

insert into public.household_meta (id, timezone)
values ('default', 'Europe/London')
on conflict (id) do nothing;

alter table public.household_meta enable row level security;

revoke all on table public.household_meta from anon, authenticated;
grant select, insert, update, delete on table public.household_meta to anon;
grant select, insert, update, delete on table public.household_meta to service_role;

drop policy if exists household_meta_anon_select on public.household_meta;
drop policy if exists household_meta_anon_insert on public.household_meta;
drop policy if exists household_meta_anon_update on public.household_meta;
drop policy if exists household_meta_anon_delete on public.household_meta;

create policy household_meta_anon_select
  on public.household_meta for select to anon using (true);

create policy household_meta_anon_insert
  on public.household_meta for insert to anon with check (true);

create policy household_meta_anon_update
  on public.household_meta for update to anon using (true) with check (true);

create policy household_meta_anon_delete
  on public.household_meta for delete to anon using (true);

-- ---------------------------------------------------------------------------
-- Points history (one row per person per closed week)
-- week_ending = Monday 00:00 household TZ that closed the prior Sunday night.
-- Unique (week_ending, person_id) makes client reset idempotent across devices.
-- ---------------------------------------------------------------------------

create table if not exists public.points_history (
  id text primary key,
  week_ending timestamptz not null,
  period_label text,
  person_id text not null references public.people (id) on delete cascade,
  display_name text not null,
  points integer not null default 0 check (points >= 0),
  created_at timestamptz not null default now()
);

alter table public.points_history add column if not exists week_ending timestamptz;
alter table public.points_history add column if not exists period_label text;
alter table public.points_history add column if not exists person_id text;
alter table public.points_history add column if not exists display_name text;
alter table public.points_history add column if not exists points integer not null default 0;
alter table public.points_history add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'points_history_week_person_uidx'
  ) then
    alter table public.points_history
      add constraint points_history_week_person_uidx
      unique (week_ending, person_id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'points_history_points_check'
  ) then
    alter table public.points_history
      add constraint points_history_points_check
      check (points >= 0);
  end if;
end $$;

create index if not exists points_history_week_ending_idx
  on public.points_history (week_ending desc);
create index if not exists points_history_person_idx
  on public.points_history (person_id);

alter table public.points_history enable row level security;

revoke all on table public.points_history from anon, authenticated;
grant select, insert, update, delete on table public.points_history to anon;
grant select, insert, update, delete on table public.points_history to service_role;

drop policy if exists points_history_anon_select on public.points_history;
drop policy if exists points_history_anon_insert on public.points_history;
drop policy if exists points_history_anon_update on public.points_history;
drop policy if exists points_history_anon_delete on public.points_history;

create policy points_history_anon_select
  on public.points_history for select to anon using (true);

create policy points_history_anon_insert
  on public.points_history for insert to anon with check (true);

create policy points_history_anon_update
  on public.points_history for update to anon using (true) with check (true);

create policy points_history_anon_delete
  on public.points_history for delete to anon using (true);
