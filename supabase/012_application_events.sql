-- 012: status history ("log") for applications.
--
-- Run once in the Supabase SQL editor (project "Autotest"), AFTER 011_pipeline_stages.sql.
-- Safe to re-run. Until it runs, the applicant window simply shows no history.
--
-- How it works
--   * A trigger on public.applications writes one row per status change (and one when an
--     application is created), whoever made the change: the HR panel, the candidate Mini App,
--     or manual SQL. Logging can never block the status change itself.
--   * Who did it:
--       hr        - the panel sends header  x-hr-actor: <hr_users.id>  with its service-role key
--                   (the header is ignored on any other key, so it cannot be forged from the Mini App)
--       candidate - new applications, and cancellations with cancelled_by = 'candidate'
--       system    - anything else (e.g. other back-end jobs)
--   * to_label keeps the stage name as it was at that moment (stages can be renamed or deleted).
--   * The table is append-only: rows cannot be updated. They are removed only together with
--     their application (on delete cascade).

create table if not exists public.application_events (
  id              bigint generated always as identity primary key,
  application_id  uuid not null references public.applications(id) on delete cascade,
  hr_user_id      uuid,                       -- owner of the vacancy at the time (for per-HR activity)
  type            text not null default 'status_change',
  from_status     text,                       -- null for the first event
  to_status       text not null,
  to_label        text,                       -- stage name at that moment; null = built-in name
  actor           text not null
                  constraint application_events_actor_check check (actor in ('hr', 'candidate', 'system')),
  actor_id        uuid,
  backfilled      boolean not null default false,  -- reconstructed from existing data by this migration
  created_at      timestamptz not null default now(),
  constraint application_events_actor_id_fkey
    foreign key (actor_id) references public.hr_users(id) on delete set null
);

-- An earlier draft of this table may already exist (it was created from the design sketch,
-- without these). Bring it up to date in place; each step is skipped when already there.
alter table public.application_events
  add column if not exists backfilled boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.application_events'::regclass and conname = 'application_events_actor_check') then
    alter table public.application_events
      add constraint application_events_actor_check check (actor in ('hr', 'candidate', 'system'));
  end if;
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.application_events'::regclass and conname = 'application_events_actor_id_fkey') then
    alter table public.application_events
      add constraint application_events_actor_id_fkey
      foreign key (actor_id) references public.hr_users(id) on delete set null;
  end if;
end;
$$;

create index if not exists application_events_application_idx
  on public.application_events (application_id, created_at);
create index if not exists application_events_hr_idx
  on public.application_events (hr_user_id, created_at desc);

-- Same model as the other panel tables: RLS on, no policies, only the service role gets in.
alter table public.application_events enable row level security;

-- ---------------------------------------------------------------- append-only
create or replace function public.application_events_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'application_events is append-only';
end;
$$;

drop trigger if exists application_events_no_update on public.application_events;
create trigger application_events_no_update
  before update on public.application_events
  for each row execute function public.application_events_append_only();

-- ---------------------------------------------------------------- the logger
create or replace function public.log_application_event()
returns trigger
language plpgsql
security definer                 -- the Mini App's role may not be allowed to write here; the logger always is
set search_path = public
as $$
declare
  v_headers   json;
  v_claims    json;
  v_role      text;
  v_hr        text;
  v_actor     text;
  v_actor_id  uuid;
  v_owner     uuid;
  v_label     text;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return null;
  end if;

  -- request context set by PostgREST (empty outside API calls, e.g. in the SQL editor)
  v_headers := nullif(current_setting('request.headers', true), '')::json;
  v_claims  := nullif(current_setting('request.jwt.claims', true), '')::json;
  v_role    := coalesce(v_claims ->> 'role', current_setting('role', true), '');
  v_hr      := v_headers ->> 'x-hr-actor';

  select v.hr_user_id into v_owner from public.vacancies v where v.id = new.vacancy_id;

  if v_role = 'service_role'
     and v_hr ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_actor := 'hr';
    v_actor_id := v_hr::uuid;
  elsif new.status = 'cancel' and new.cancelled_by = 'candidate' then
    v_actor := 'candidate';
  elsif tg_op = 'INSERT' or v_role in ('anon', 'authenticated') then
    v_actor := 'candidate';
  else
    v_actor := 'system';
  end if;

  -- the HR's own name for the stage, if they renamed it (011); built-in names stay null
  if v_owner is not null and to_regclass('public.pipeline_stages') is not null then
    execute 'select label from public.pipeline_stages where hr_user_id = $1 and key = $2'
      into v_label using v_owner, new.status;
  end if;

  insert into public.application_events
    (application_id, hr_user_id, type, from_status, to_status, to_label, actor, actor_id)
  values
    (new.id, v_owner, 'status_change',
     case when tg_op = 'UPDATE' then old.status end,
     new.status, v_label, v_actor, v_actor_id);

  return null;
exception when others then
  -- a broken log must never block hiring: keep the status change, just warn
  raise warning 'application_events logging failed: %', sqlerrm;
  return null;
end;
$$;

drop trigger if exists applications_log_insert on public.applications;
create trigger applications_log_insert
  after insert on public.applications
  for each row execute function public.log_application_event();

drop trigger if exists applications_log_status on public.applications;
create trigger applications_log_status
  after update of status on public.applications
  for each row execute function public.log_application_event();

-- ---------------------------------------------------------------- backfill
-- Existing applications get an approximate history, marked backfilled = true:
--   1) "applied" at created_at
insert into public.application_events
  (application_id, hr_user_id, from_status, to_status, actor, backfilled, created_at)
select a.id, v.hr_user_id, null, 'new', 'candidate', true, a.created_at
from public.applications a
left join public.vacancies v on v.id = a.vacancy_id
where not exists (select 1 from public.application_events e where e.application_id = a.id);

--   2) its current stage at updated_at (when it is no longer 'new')
insert into public.application_events
  (application_id, hr_user_id, from_status, to_status, actor, backfilled, created_at)
select a.id, v.hr_user_id, 'new', a.status,
       case when a.status = 'cancel' and a.cancelled_by = 'candidate' then 'candidate' else 'system' end,
       true, greatest(a.updated_at, a.created_at)
from public.applications a
left join public.vacancies v on v.id = a.vacancy_id
where a.status <> 'new'
  and exists (select 1 from public.application_events e where e.application_id = a.id and e.backfilled)
  and not exists (select 1 from public.application_events e where e.application_id = a.id and e.to_status = a.status);

-- let the API see the new table right away
notify pgrst, 'reload schema';
