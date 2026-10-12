-- Household chores — piggyback on the existing School Compass Supabase
-- project (same project as Comparison-tool / schoolcompass.uk).
-- Do NOT run this on the home_learning project.
--
-- One-time setup (or re-run after pulls):
--   1. Open the School Compass project in Supabase
--   2. SQL → New query → paste this file → Run
--   3. Storage → create public bucket `chore-photos` if the insert below
--      did not (Dashboard may require manual create on some plans)
--
-- Safe to re-run. Keeps legacy `public.chores` and adds people / templates /
-- instances / completion_events for the richer chore model.
-- This slice also adds: template recurrence + points; completion assessment.

-- ---------------------------------------------------------------------------
-- Legacy flat board (Pages fallback + older clients)
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

create table if not exists public.people (
  id text primary key,
  display_name text not null,
  role text not null default 'child'
    check (role in ('parent', 'child', 'other')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists people_display_name_ci_idx
  on public.people (lower(display_name));

alter table public.people enable row level security;

revoke all on table public.people from anon, authenticated;
grant select, insert, update, delete on table public.people to anon;
grant select, insert, update, delete on table public.people to service_role;

drop policy if exists people_anon_select on public.people;
drop policy if exists people_anon_insert on public.people;
drop policy if exists people_anon_update on public.people;
drop policy if exists people_anon_delete on public.people;

create policy people_anon_select
  on public.people for select to anon using (true);

create policy people_anon_insert
  on public.people for insert to anon
  with check (char_length(display_name) between 1 and 80);

create policy people_anon_update
  on public.people for update to anon using (true) with check (true);

create policy people_anon_delete
  on public.people for delete to anon using (true);

-- ---------------------------------------------------------------------------
-- Task templates (recurring kinds + steps + reference photo)
-- ---------------------------------------------------------------------------

create table if not exists public.task_templates (
  id text primary key,
  title text not null,
  description text,
  parent_template_id text references public.task_templates (id) on delete set null,
  kind text not null default 'once'
    check (kind in ('daily', 'periodic', 'once')),
  -- Legacy day-based cooldown (kept for nudges / older clients).
  -- Prefer recurrence_interval + recurrence_unit; sync cooldown_days on write.
  cooldown_days integer,
  -- Periodic default product rule: every 4 weeks (custom N day|week allowed).
  recurrence_interval integer,
  recurrence_unit text
    check (recurrence_unit is null or recurrence_unit in ('day', 'week')),
  -- Reward points (admin/parent sets); awarded on assessment approve.
  points integer not null default 1
    check (points >= 0),
  estimated_minutes integer,
  effort_weight numeric not null default 1,
  steps jsonb not null default '[]'::jsonb,
  reference_photo_path text,
  default_assignee_person_id text references public.people (id) on delete set null,
  created_from text not null default 'manual'
    check (created_from in ('notice', 'manual', 'import', 'split')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Additive columns when the table already existed without them (single-line for paste safety).
alter table public.task_templates add column if not exists recurrence_interval integer;
alter table public.task_templates add column if not exists recurrence_unit text;
alter table public.task_templates add column if not exists points integer not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'task_templates_recurrence_unit_check'
  ) then
    alter table public.task_templates
      add constraint task_templates_recurrence_unit_check
      check (recurrence_unit is null or recurrence_unit in ('day', 'week'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'task_templates_points_check'
  ) then
    alter table public.task_templates
      add constraint task_templates_points_check
      check (points >= 0);
  end if;
end $$;

create index if not exists task_templates_parent_idx
  on public.task_templates (parent_template_id);
create index if not exists task_templates_active_idx
  on public.task_templates (active);

alter table public.task_templates enable row level security;

revoke all on table public.task_templates from anon, authenticated;
grant select, insert, update, delete on table public.task_templates to anon;
grant select, insert, update, delete on table public.task_templates to service_role;

drop policy if exists task_templates_anon_select on public.task_templates;
drop policy if exists task_templates_anon_insert on public.task_templates;
drop policy if exists task_templates_anon_update on public.task_templates;
drop policy if exists task_templates_anon_delete on public.task_templates;

create policy task_templates_anon_select
  on public.task_templates for select to anon using (true);

create policy task_templates_anon_insert
  on public.task_templates for insert to anon
  with check (char_length(title) between 1 and 200);

create policy task_templates_anon_update
  on public.task_templates for update to anon using (true) with check (true);

create policy task_templates_anon_delete
  on public.task_templates for delete to anon using (true);

-- ---------------------------------------------------------------------------
-- Task instances (actionable work)
-- ---------------------------------------------------------------------------

create table if not exists public.task_instances (
  id text primary key,
  template_id text references public.task_templates (id) on delete set null,
  parent_instance_id text references public.task_instances (id) on delete set null,
  title text not null,
  description text,
  estimated_minutes integer,
  status text not null default 'open'
    check (status in ('noticed', 'open', 'assigned', 'done', 'waiting', 'retired')),
  assignee_person_id text references public.people (id) on delete set null,
  -- Denormalized display name for list UIs / legacy parity
  assignee text,
  noticed_at timestamptz,
  opened_at timestamptz,
  assigned_at timestamptz,
  completed_at timestamptz,
  due_at timestamptz,
  due_date date,
  source text not null default 'manual'
    check (source in ('notice', 'schedule', 'manual', 'split')),
  created_at timestamptz not null default now()
);

create index if not exists task_instances_status_idx
  on public.task_instances (status);
create index if not exists task_instances_created_at_idx
  on public.task_instances (created_at desc);
create index if not exists task_instances_assignee_person_idx
  on public.task_instances (assignee_person_id);
create index if not exists task_instances_template_idx
  on public.task_instances (template_id);

alter table public.task_instances enable row level security;

revoke all on table public.task_instances from anon, authenticated;
grant select, insert, update, delete on table public.task_instances to anon;
grant select, insert, update, delete on table public.task_instances to service_role;

drop policy if exists task_instances_anon_select on public.task_instances;
drop policy if exists task_instances_anon_insert on public.task_instances;
drop policy if exists task_instances_anon_update on public.task_instances;
drop policy if exists task_instances_anon_delete on public.task_instances;

create policy task_instances_anon_select
  on public.task_instances for select to anon using (true);

create policy task_instances_anon_insert
  on public.task_instances for insert to anon
  with check (char_length(title) between 1 and 200);

create policy task_instances_anon_update
  on public.task_instances for update to anon using (true) with check (true);

create policy task_instances_anon_delete
  on public.task_instances for delete to anon using (true);

-- ---------------------------------------------------------------------------
-- Completion events (effort signal + temporary proof photo)
-- Proof TTL (product default): 7 days from completed_at, or until the next
-- completion for the same template — whichever first. App sets proof_expires_at.
-- ---------------------------------------------------------------------------

create table if not exists public.completion_events (
  id text primary key,
  instance_id text not null references public.task_instances (id) on delete cascade,
  template_id text references public.task_templates (id) on delete set null,
  person_id text references public.people (id) on delete set null,
  completed_at timestamptz not null default now(),
  actual_minutes integer,
  felt_difficulty text check (
    felt_difficulty is null
    or felt_difficulty in ('easy', 'ok', 'hard')
  ),
  estimated_minutes_at_start integer,
  proof_photo_path text,
  proof_expires_at timestamptz,
  -- Points land on the scoreboard only after parent/admin assessment.
  assessment_status text not null default 'pending'
    check (assessment_status in ('pending', 'approved', 'rejected')),
  points_awarded integer,
  assessed_by_person_id text references public.people (id) on delete set null,
  assessed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.completion_events add column if not exists assessment_status text not null default 'pending';
alter table public.completion_events add column if not exists points_awarded integer;
alter table public.completion_events add column if not exists assessed_by_person_id text references public.people (id) on delete set null;
alter table public.completion_events add column if not exists assessed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'completion_events_assessment_status_check'
  ) then
    alter table public.completion_events
      add constraint completion_events_assessment_status_check
      check (assessment_status in ('pending', 'approved', 'rejected'));
  end if;
end $$;

create index if not exists completion_events_instance_idx
  on public.completion_events (instance_id);
create index if not exists completion_events_template_idx
  on public.completion_events (template_id);
create index if not exists completion_events_proof_expires_idx
  on public.completion_events (proof_expires_at)
  where proof_photo_path is not null;
create index if not exists completion_events_assessment_idx
  on public.completion_events (assessment_status);
create index if not exists completion_events_person_awarded_idx
  on public.completion_events (person_id)
  where assessment_status = 'approved';

alter table public.completion_events enable row level security;

revoke all on table public.completion_events from anon, authenticated;
grant select, insert, update, delete on public.completion_events to anon;
grant select, insert, update, delete on public.completion_events to service_role;

drop policy if exists completion_events_anon_select on public.completion_events;
drop policy if exists completion_events_anon_insert on public.completion_events;
drop policy if exists completion_events_anon_update on public.completion_events;
drop policy if exists completion_events_anon_delete on public.completion_events;

create policy completion_events_anon_select
  on public.completion_events for select to anon using (true);

create policy completion_events_anon_insert
  on public.completion_events for insert to anon with check (true);

create policy completion_events_anon_update
  on public.completion_events for update to anon using (true) with check (true);

create policy completion_events_anon_delete
  on public.completion_events for delete to anon using (true);

-- ---------------------------------------------------------------------------
-- Storage: chore-photos (reference = durable; proof = temporary)
-- Manual fallback: Dashboard → Storage → New bucket → id `chore-photos`, public.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chore-photos',
  'chore-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists chore_photos_anon_select on storage.objects;
drop policy if exists chore_photos_anon_insert on storage.objects;
drop policy if exists chore_photos_anon_update on storage.objects;
drop policy if exists chore_photos_anon_delete on storage.objects;

create policy chore_photos_anon_select
  on storage.objects for select to anon
  using (bucket_id = 'chore-photos');

create policy chore_photos_anon_insert
  on storage.objects for insert to anon
  with check (bucket_id = 'chore-photos');

create policy chore_photos_anon_update
  on storage.objects for update to anon
  using (bucket_id = 'chore-photos')
  with check (bucket_id = 'chore-photos');

create policy chore_photos_anon_delete
  on storage.objects for delete to anon
  using (bucket_id = 'chore-photos');

-- Optional realtime (UI also polls every ~10s):
-- alter publication supabase_realtime add table public.chores;
-- alter publication supabase_realtime add table public.task_instances;
