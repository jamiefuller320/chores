-- Household chores table — piggyback on the existing School Compass Supabase
-- project (same project as Comparison-tool / schoolcompass.uk).
-- Do NOT run this on the home_learning project.
--
-- One-time setup:
--   1. Open the School Compass project in Supabase
--   2. SQL → New query → paste this file → Run
--
-- Safe to re-run.

create table if not exists public.chores (
  id text primary key,
  title text not null,
  description text,
  assignee text,
  status text not null default 'open'
    check (status in ('open', 'done')),
  due_date date,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists chores_status_idx on public.chores (status);
create index if not exists chores_created_at_idx on public.chores (created_at desc);

alter table public.chores enable row level security;

revoke all on table public.chores from anon, authenticated;
grant select, insert, update, delete on table public.chores to anon;
grant select, insert, update, delete on table public.chores to service_role;

drop policy if exists chores_anon_select on public.chores;
drop policy if exists chores_anon_insert on public.chores;
drop policy if exists chores_anon_update on public.chores;
drop policy if exists chores_anon_delete on public.chores;
drop policy if exists "chores_anon_select" on public.chores;
drop policy if exists "chores_anon_insert" on public.chores;
drop policy if exists "chores_anon_update" on public.chores;
drop policy if exists "chores_anon_delete" on public.chores;

create policy chores_anon_select
  on public.chores for select to anon
  using (true);

create policy chores_anon_insert
  on public.chores for insert to anon
  with check (
    status in ('open', 'done')
    and char_length(title) between 1 and 200
  );

create policy chores_anon_update
  on public.chores for update to anon
  using (true)
  with check (status in ('open', 'done'));

create policy chores_anon_delete
  on public.chores for delete to anon
  using (true);

-- Optional realtime (UI also polls every ~10s):
-- alter publication supabase_realtime add table public.chores;
