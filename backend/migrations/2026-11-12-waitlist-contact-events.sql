-- normie. migration 2026-11-12 (run once in Supabase > SQL Editor, after schema.sql)
-- Adds: box reservations saved with the waitlist email, a public waitlist count,
--       a working contact form, and first-party event tracking.
-- Safe to re-run.

-- ---------- 1. box reservations on the email list ----------
alter table public.subscribers add column if not exists box_pack    text;
alter table public.subscribers add column if not exists box_mix     jsonb;
alter table public.subscribers add column if not exists reserved_at timestamptz;

-- Save an email plus the box the visitor built. Never reveals whether the email already existed.
-- p_pack: 'special' | '6' | '12'. p_mix: {"matcha":n,"acai":n,"coffee":n}, must add up to the pack size. '6' and '12' are even splits; 'special' is any mix of 12.
create or replace function public.reserve_box(p_email text, p_pack text, p_mix jsonb, p_source text default 'box')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_size  int;
  v_m int; v_a int; v_c int;
begin
  if v_email is null or length(v_email) > 254 or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  v_size := case p_pack when 'special' then 12 when '12' then 12 when '6' then 6 else null end;
  if v_size is null then raise exception 'invalid pack' using errcode = '22023'; end if;
  v_m := coalesce((p_mix ->> 'matcha')::int, 0);
  v_a := coalesce((p_mix ->> 'acai')::int, 0);
  v_c := coalesce((p_mix ->> 'coffee')::int, 0);
  if least(v_m, v_a, v_c) < 0 or v_m + v_a + v_c <> v_size then
    raise exception 'invalid mix' using errcode = '22023';
  end if;
  -- the 6-pack and 12-pack are set boxes (even split); the normie special is any mix of 12
  if p_pack in ('6', '12') and (v_m <> v_size / 3 or v_a <> v_size / 3 or v_c <> v_size / 3) then
    raise exception 'invalid mix' using errcode = '22023';
  end if;
  insert into public.subscribers (email, source, box_pack, box_mix, reserved_at)
  values (v_email, left(coalesce(p_source, 'box'), 40), p_pack,
          jsonb_build_object('matcha', v_m, 'acai', v_a, 'coffee', v_c), now())
  on conflict (email) do update
     set box_pack = excluded.box_pack, box_mix = excluded.box_mix,
         reserved_at = excluded.reserved_at, unsubscribed_at = null;
end;
$$;
revoke all on function public.reserve_box(text, text, jsonb, text) from public;
grant execute on function public.reserve_box(text, text, jsonb, text) to anon, authenticated;

-- Public waitlist size (a number only, no emails).
create or replace function public.waitlist_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$ select count(*)::int from public.subscribers where unsubscribed_at is null; $$;
revoke all on function public.waitlist_count() from public;
grant execute on function public.waitlist_count() to anon, authenticated;

-- ---------- 2. contact form ----------
create table if not exists public.contact_messages (
  id          bigint generated always as identity primary key,
  name        text not null check (length(name) between 1 and 120),
  email       text not null check (email = lower(email) and length(email) <= 254),
  message     text not null check (length(message) between 1 and 4000),
  handled_at  timestamptz,
  created_at  timestamptz not null default now()
);
alter table public.contact_messages enable row level security;
revoke all on public.contact_messages from anon, authenticated;

create or replace function public.send_contact(p_name text, p_email text, p_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_email text := lower(trim(p_email));
begin
  if v_email is null or length(v_email) > 254 or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  if coalesce(length(trim(p_name)), 0) = 0 or coalesce(length(trim(p_message)), 0) = 0 then
    raise exception 'missing field' using errcode = '22023';
  end if;
  -- simple flood guard: 3 messages per email per hour
  if (select count(*) from public.contact_messages
       where email = v_email and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'rate limited' using errcode = '22023';
  end if;
  insert into public.contact_messages (name, email, message)
  values (left(trim(p_name), 120), v_email, left(trim(p_message), 4000));
end;
$$;
revoke all on function public.send_contact(text, text, text) from public;
grant execute on function public.send_contact(text, text, text) to anon, authenticated;

-- ---------- 3. first-party analytics (no cookies, no personal data) ----------
create table if not exists public.site_events (
  id          bigint generated always as identity primary key,
  name        text not null,
  page        text,
  detail      text,
  created_at  timestamptz not null default now()
);
create index if not exists site_events_name_time_idx on public.site_events (name, created_at);
alter table public.site_events enable row level security;
revoke all on public.site_events from anon, authenticated;

create or replace function public.log_event(p_name text, p_page text default null, p_detail text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_name is null or p_name !~ '^[a-z0-9_:-]{1,40}$' then return; end if;
  insert into public.site_events (name, page, detail)
  values (p_name, left(p_page, 120), left(p_detail, 120));
end;
$$;
revoke all on function public.log_event(text, text, text) from public;
grant execute on function public.log_event(text, text, text) to anon, authenticated;

-- Handy reports (run in the SQL editor):
--   select name, count(*) from site_events where created_at > now() - interval '7 days' group by 1 order by 2 desc;
--   select box_pack, box_mix, count(*) from subscribers where reserved_at is not null group by 1, 2 order by 3 desc;
--   select * from contact_messages where handled_at is null order by created_at;
