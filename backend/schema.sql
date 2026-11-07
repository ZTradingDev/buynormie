-- normie. backend schema for Supabase (run once in the SQL editor).
-- Security model:
--   * Row Level Security is ON for every table.
--   * The browser only ever holds the public "anon" key. It can call the two RPC functions below
--     and read its own rows when signed in. It can never read the email list or anyone else's orders.
--   * Orders are written only by the stripe-webhook Edge Function using the service role key,
--     after Stripe's signature is verified.

-- ---------- email list ----------
create table if not exists public.subscribers (
  id          bigint generated always as identity primary key,
  email       text not null unique check (email = lower(email)),
  source      text not null default 'site',
  created_at  timestamptz not null default now(),
  unsubscribed_at timestamptz,
  constraint subscribers_email_format check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254)
);
alter table public.subscribers enable row level security;
-- no policies: nobody can select/insert/update directly from the browser.
revoke all on public.subscribers from anon, authenticated;

-- Add an email to the list. Safe to call repeatedly; never reveals whether the email already existed.
create or replace function public.subscribe(p_email text, p_source text default 'site')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_email is null or length(p_email) > 254 or p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  insert into public.subscribers (email, source)
  values (lower(trim(p_email)), left(coalesce(p_source, 'site'), 40))
  on conflict (email) do update set unsubscribed_at = null;
end;
$$;
revoke all on function public.subscribe(text, text) from public;
grant execute on function public.subscribe(text, text) to anon, authenticated;

-- ---------- orders (written by the Stripe webhook only) ----------
create table if not exists public.orders (
  id                 bigint generated always as identity primary key,
  stripe_session_id  text not null unique,
  user_id            uuid references auth.users (id) on delete set null,
  email              text not null check (email = lower(email)),
  boxes              integer not null default 1 check (boxes > 0 and boxes <= 50),
  amount_total       integer not null,            -- cents
  currency           text not null default 'usd',
  free_box           boolean not null default false,
  status             text not null default 'paid',
  created_at         timestamptz not null default now()
);
create index if not exists orders_email_idx on public.orders (email);
create index if not exists orders_user_idx on public.orders (user_id);
alter table public.orders enable row level security;
revoke all on public.orders from anon, authenticated;
grant select on public.orders to authenticated;
drop policy if exists "read own orders" on public.orders;
create policy "read own orders" on public.orders
  for select to authenticated
  using (user_id = auth.uid() or email = lower(auth.jwt() ->> 'email'));

-- ---------- rewards (free-box codes issued by the webhook) ----------
create table if not exists public.reward_codes (
  id                bigint generated always as identity primary key,
  email             text not null check (email = lower(email)),
  code              text not null unique,
  stripe_promo_id   text not null unique,
  redeemed_at       timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists reward_codes_email_idx on public.reward_codes (email);
alter table public.reward_codes enable row level security;
revoke all on public.reward_codes from anon, authenticated;
grant select on public.reward_codes to authenticated;
drop policy if exists "read own codes" on public.reward_codes;
create policy "read own codes" on public.reward_codes
  for select to authenticated
  using (email = lower(auth.jwt() ->> 'email'));

-- Rewards summary for the signed-in customer.
-- Paid (non-free) boxes earn stamps; every p_goal stamps earns one free box.
create or replace function public.my_rewards(p_goal integer default 5)
returns table (paid_boxes integer, stamps integer, free_boxes_earned integer, open_code text)
language sql
stable
security definer
set search_path = public
as $$
  with me as (select lower(auth.jwt() ->> 'email') as email),
  b as (
    select coalesce(sum(o.boxes) filter (where not o.free_box), 0)::int as paid
    from public.orders o, me where o.email = me.email and o.status = 'paid'
  )
  select b.paid,
         (b.paid % greatest(p_goal, 1))::int,
         (b.paid / greatest(p_goal, 1))::int,
         (select rc.code from public.reward_codes rc, me
           where rc.email = me.email and rc.redeemed_at is null
           order by rc.created_at limit 1)
  from b
  where (select email from me) is not null;
$$;
revoke all on function public.my_rewards(integer) from public;
grant execute on function public.my_rewards(integer) to authenticated;
