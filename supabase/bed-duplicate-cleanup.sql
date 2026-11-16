-- Paste into School Compass Supabase → SQL → New query → Run.
-- Safe to re-run. Pages client also dedupes on load after this PR deploys.
--
-- Root cause: completing a daily always spawned a new waiting instance even when
-- another open/waiting row for the same template already existed. Emily's bed
-- ended up with three open instances of tmpl_mvbbjnic_ludozi.
--
-- Theo's bed (tmpl_mv6ft1db_xwmzwk) already has one open instance — it was not
-- missing in the DB; Emily triples just crowded the top of the Open list.
-- Sebby's bed template (tmpl_mv6fq5hj_u3z8ms) is kind=once and already done —
-- recreate as Daily via New task (or use the optional block at the bottom).

-- 1) Keep the newest open/assigned/noticed row per template; retire the rest.
with ranked as (
  select
    id,
    row_number() over (
      partition by template_id
      order by created_at desc nulls last, id desc
    ) as rn
  from public.task_instances
  where template_id is not null
    and status in ('noticed', 'open', 'assigned')
)
update public.task_instances ti
set status = 'retired'
from ranked r
where ti.id = r.id
  and r.rn > 1;

-- 2) If a template already has an open cycle, retire waiting copies that would
-- promote into a second open row (daily miss = same instance stays open).
update public.task_instances w
set status = 'retired'
where w.status = 'waiting'
  and w.template_id is not null
  and exists (
    select 1
    from public.task_instances o
    where o.template_id = w.template_id
      and o.status in ('noticed', 'open', 'assigned')
  );

-- 3) Optional: also collapse multiple waiting rows per template (keep newest).
with waiting_ranked as (
  select
    id,
    row_number() over (
      partition by template_id
      order by created_at desc nulls last, id desc
    ) as rn
  from public.task_instances
  where template_id is not null
    and status = 'waiting'
)
update public.task_instances ti
set status = 'retired'
from waiting_ranked r
where ti.id = r.id
  and r.rn > 1;

-- ---------------------------------------------------------------------------
-- OPTIONAL — only if you want Sebby's bed back as a daily without using the UI.
-- Prefer: New task → "Make Sebby's bed" → Daily. Do not run blindly.
-- ---------------------------------------------------------------------------
-- update public.task_templates
-- set kind = 'daily', active = true
-- where id = 'tmpl_mv6fq5hj_u3z8ms';
--
-- insert into public.task_instances (
--   id, template_id, title, estimated_minutes, status, opened_at, source, created_at
-- )
-- select
--   'inst_sebby_bed_reopen',
--   'tmpl_mv6fq5hj_u3z8ms',
--   title,
--   coalesce(estimated_minutes, 10),
--   'open',
--   now(),
--   'manual',
--   now()
-- from public.task_templates
-- where id = 'tmpl_mv6fq5hj_u3z8ms'
--   and not exists (
--     select 1 from public.task_instances
--     where template_id = 'tmpl_mv6fq5hj_u3z8ms'
--       and status in ('noticed', 'open', 'assigned', 'waiting')
--   );
