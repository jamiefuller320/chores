-- Paste into School Compass Supabase → SQL → New query → Run.
-- Adds people.color (#RRGGBB) for identity page-background tinting.
-- Safe to re-run. Also in repo supabase/schema.sql.

alter table public.people add column if not exists color text;

update public.people as p
set color = d.color
from (
  select
    id,
    (array[
      '#3d8b6e',
      '#c46b3a',
      '#3a7ca5',
      '#b85c7a',
      '#8a7a3d',
      '#2e8b8b',
      '#c49a3a',
      '#6d7f9c'
    ])[
      ((row_number() over (order by created_at nulls last, id) - 1) % 8) + 1
    ] as color
  from public.people
) as d
where p.id = d.id
  and (
    p.color is null
    or btrim(p.color) = ''
    or p.color !~ '^#[0-9A-Fa-f]{6}$'
  );

alter table public.people
  alter column color set default '#3d8b6e';

update public.people set color = '#3d8b6e' where color is null;

alter table public.people
  alter column color set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'people_color_hex_check'
  ) then
    alter table public.people
      add constraint people_color_hex_check
      check (color ~ '^#[0-9A-Fa-f]{6}$');
  end if;
end $$;
