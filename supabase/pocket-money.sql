-- Paste into School Compass Supabase → SQL → New query → Run.
-- Per-child points target + pocket money (£) settings and running owed tally.
-- Safe to re-run. Also in repo supabase/schema.sql.
--
-- Manage: set points_target + pocket_money_amount per child.
-- Weekly reset (client): when closed-week points >= points_target (>0),
--   add pocket_money_amount to pocket_money_owed (idempotent via
--   pocket_money_last_credited_week = that week_ending).
-- Manage "Pocket Money Paid": sets pocket_money_owed to 0.

alter table public.people
  add column if not exists points_target integer;

alter table public.people
  add column if not exists pocket_money_amount numeric(10, 2);

alter table public.people
  add column if not exists pocket_money_owed numeric(10, 2);

alter table public.people
  add column if not exists pocket_money_last_credited_week timestamptz;

update public.people
set pocket_money_amount = 0
where pocket_money_amount is null;

update public.people
set pocket_money_owed = 0
where pocket_money_owed is null;

alter table public.people
  alter column pocket_money_amount set default 0;

alter table public.people
  alter column pocket_money_owed set default 0;

alter table public.people
  alter column pocket_money_amount set not null;

alter table public.people
  alter column pocket_money_owed set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'people_points_target_check'
  ) then
    alter table public.people
      add constraint people_points_target_check
      check (points_target is null or points_target >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'people_pocket_money_amount_check'
  ) then
    alter table public.people
      add constraint people_pocket_money_amount_check
      check (pocket_money_amount >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'people_pocket_money_owed_check'
  ) then
    alter table public.people
      add constraint people_pocket_money_owed_check
      check (pocket_money_owed >= 0);
  end if;
end $$;
