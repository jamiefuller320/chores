-- Chores household board for GitHub Pages + Supabase.
-- Run this once in the Supabase SQL editor.

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

drop policy if exists "chores_anon_select" on public.chores;
drop policy if exists "chores_anon_insert" on public.chores;
drop policy if exists "chores_anon_update" on public.chores;
drop policy if exists "chores_anon_delete" on public.chores;

-- Private household use: anon key can read/write this table.
-- Tighten later with Supabase Auth if you need per-user access.
create policy "chores_anon_select"
  on public.chores for select to anon using (true);

create policy "chores_anon_insert"
  on public.chores for insert to anon with check (true);

create policy "chores_anon_update"
  on public.chores for update to anon using (true) with check (true);

create policy "chores_anon_delete"
  on public.chores for delete to anon using (true);

-- Optional: live updates (UI also polls as a fallback).
-- Dashboard → Database → Publications → supabase_realtime → enable `chores`
-- or run:
-- alter publication supabase_realtime add table public.chores;
