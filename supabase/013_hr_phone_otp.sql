-- 013: phone number + one-time code for HR sign-up and sign-in.
--
-- Run once in the Supabase SQL editor (project "Autotest"). Safe to re-run.
-- Until it runs, sign-in and sign-up answer "needs a database update" instead of logging in.
--
-- Flow (all through the panel API with the service role):
--   sign-up  : username + password + phone  -> code to the phone -> account is created
--   sign-in  : username + password          -> code to the saved phone -> session
--              (skipped on a device the HR marked as trusted for 30 days)
--   old accounts without a phone add one at their next sign-in (purpose 'enroll').
-- The code goes out by SMS through Eskiz.uz ('telegram' in the channel check is unused).

-- 1. The HR's verified phone, E.164 (+998901234567). One account per phone.
alter table public.hr_users add column if not exists phone text;

alter table public.hr_users drop constraint if exists hr_users_phone_check;
alter table public.hr_users
  add constraint hr_users_phone_check check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$');

create unique index if not exists hr_users_phone_key on public.hr_users (phone) where phone is not null;

-- 2. One row per code request. Only a keyed hash of the code is stored.
create table if not exists public.hr_otp_challenges (
  id            uuid primary key default gen_random_uuid(),
  purpose       text not null check (purpose in ('register', 'login', 'enroll')),
  phone         text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  -- login / enroll: the account; register: null until the code is confirmed
  hr_user_id    uuid references public.hr_users(id) on delete cascade,
  -- register only: {username, password_hash}; cleared once the code is used
  pending       jsonb,
  code_hash     text not null,
  channel       text not null check (channel in ('telegram', 'sms', 'dev')),
  provider_ref  text,
  attempts      smallint not null default 0,
  sends         smallint not null default 1,
  last_sent_at  timestamptz not null default now(),
  expires_at    timestamptz not null,
  consumed_at   timestamptz,
  ip            text,
  created_at    timestamptz not null default now()
);

-- rate limits look back one hour by phone and by IP
create index if not exists hr_otp_challenges_phone_idx on public.hr_otp_challenges (phone, created_at desc);
create index if not exists hr_otp_challenges_ip_idx on public.hr_otp_challenges (ip, created_at desc);
create index if not exists hr_otp_challenges_created_idx on public.hr_otp_challenges (created_at);

-- Same model as the other panel tables: RLS on, no policies, only the service role gets in.
alter table public.hr_otp_challenges enable row level security;

notify pgrst, 'reload schema';
