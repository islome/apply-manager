-- 011: custom pipeline stages per HR.
--
-- Run once in the Supabase SQL editor (project "Autotest"). Safe to re-run.
-- Until it runs, the panel keeps working with the 5 default stages; only saving stages fails.
--
-- applications.status keeps holding a stage key. Core keys keep their behaviour:
--   new    = where new applications land (the Mini App inserts 'new')
--   hired  = success stage: adds the person to hired_employees, "hired" Telegram message
--   cancel = final stage: "not selected" Telegram message
-- Custom stages get keys like 's_3f9a1c2b' and send a generic "moved to <stage>" message.

create table if not exists public.pipeline_stages (
  id          uuid primary key default gen_random_uuid(),
  hr_user_id  uuid not null references public.hr_users(id) on delete cascade,
  key         text not null check (key ~ '^[a-z][a-z0-9_]{0,39}$'),
  label       text check (label is null or char_length(label) between 1 and 40),
  color       text not null check (color ~ '^#[0-9a-f]{6}$'),
  position    smallint not null,
  created_at  timestamptz not null default now(),
  unique (hr_user_id, key)
);

create index if not exists pipeline_stages_hr_position_idx
  on public.pipeline_stages (hr_user_id, position);

-- Same model as the other panel tables: RLS on, no policies, only the service role (the panel API) gets in.
alter table public.pipeline_stages enable row level security;

-- The old check only allowed the fixed statuses. Allow any stage key instead
-- (every existing value - new, confirmed, interview, hired, cancel, reviewed, ... - still matches).
alter table public.applications drop constraint if exists applications_status_check;
alter table public.applications
  add constraint applications_status_check check (status ~ '^[a-z][a-z0-9_]{0,39}$');
