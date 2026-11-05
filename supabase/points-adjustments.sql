-- Paste into School Compass Supabase → SQL → New query → Run.
-- Manual points corrections (add/remove) for the weekly scoreboard.
-- Safe to re-run. Also in repo supabase/schema.sql.
--
-- Scoreboard (this week) =
--   sum(approved completion points_awarded since last_points_reset_at)
--   + sum(points_adjustments.points where created_at >= last_points_reset_at)
-- points is signed: positive adds, negative removes.

create table if not exists public.points_adjustments (
  id text primary key,
  person_id text not null references public.people (id) on delete cascade,
  points integer not null,
  reason text,
  created_at timestamptz not null default now(),
  created_by_person_id text references public.people (id) on delete set null
);

alter table public.points_adjustments add column if not exists person_id text;
alter table public.points_adjustments add column if not exists points integer;
alter table public.points_adjustments add column if not exists reason text;
alter table public.points_adjustments add column if not exists created_at timestamptz not null default now();
alter table public.points_adjustments add column if not exists created_by_person_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'points_adjustments_points_nonzero_check'
  ) then
    alter table public.points_adjustments
      add constraint points_adjustments_points_nonzero_check
      check (points <> 0);
  end if;
end $$;

create index if not exists points_adjustments_person_idx
  on public.points_adjustments (person_id);
create index if not exists points_adjustments_created_at_idx
  on public.points_adjustments (created_at desc);
create index if not exists points_adjustments_person_created_idx
  on public.points_adjustments (person_id, created_at desc);

alter table public.points_adjustments enable row level security;

revoke all on table public.points_adjustments from anon, authenticated;
grant select, insert, update, delete on table public.points_adjustments to anon;
grant select, insert, update, delete on table public.points_adjustments to service_role;

drop policy if exists points_adjustments_anon_select on public.points_adjustments;
drop policy if exists points_adjustments_anon_insert on public.points_adjustments;
drop policy if exists points_adjustments_anon_update on public.points_adjustments;
drop policy if exists points_adjustments_anon_delete on public.points_adjustments;

create policy points_adjustments_anon_select
  on public.points_adjustments for select to anon using (true);

create policy points_adjustments_anon_insert
  on public.points_adjustments for insert to anon
  with check (points <> 0);

create policy points_adjustments_anon_update
  on public.points_adjustments for update to anon using (true) with check (points <> 0);

create policy points_adjustments_anon_delete
  on public.points_adjustments for delete to anon using (true);
