-- Welcome email with a personal 10% off code, sent once when a customer first signs in
-- (first time their email is confirmed). Emails go out through Resend's API, scheduled 30 seconds
-- after sign-in, subject "welcome to normie.", with HTML and plain-text versions.
-- Requires a Vault secret named resend_api_key (a Resend "Sending access" key),
-- added by the account owner in Supabase > Integrations > Vault. If it's missing, the code
-- is still created and shown in the customer's account; the email is skipped.

create extension if not exists pg_net with schema extensions;

create table if not exists public.welcome_codes (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  email        text not null check (email = lower(email)),
  code         text not null unique,
  percent_off  integer not null default 10 check (percent_off between 1 and 100),
  emailed_at   timestamptz,
  redeemed_at  timestamptz,
  created_at   timestamptz not null default now()
);
alter table public.welcome_codes enable row level security;
revoke all on public.welcome_codes from anon, authenticated;
grant select on public.welcome_codes to authenticated;
drop policy if exists "read own welcome code" on public.welcome_codes;
create policy "read own welcome code" on public.welcome_codes
  for select to authenticated using (user_id = auth.uid());

create or replace function public.send_welcome_email(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r public.welcome_codes%rowtype;
  k text;
  html text;
begin
  select * into r from public.welcome_codes where user_id = p_user;
  if not found or r.emailed_at is not null then return; end if;
  select decrypted_secret into k from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  if k is null or k = '' then return; end if;

  html := format($h$<div style="background:#f6f1e8;padding:40px 16px;font-family:Helvetica,Arial,sans-serif;color:#304236">
  <div style="max-width:480px;margin:0 auto;background:#fbf8f2;border:1px solid #e3dccf;border-radius:20px;padding:36px 32px">
    <p style="margin:0 0 28px;font-size:28px;font-weight:700;letter-spacing:-1px">normie.</p>
    <h1 style="margin:0 0 12px;font-size:26px;font-weight:400;letter-spacing:-0.5px;line-height:1.15">welcome to normie.</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#5d6a5f">Thanks for joining. Here is %s%% off your first box: 4 matcha, 4 açaí and 4 coffee sticks. Every box you order also earns a rewards stamp, and 5 stamps get you a free box.</p>
    <div style="border:1.5px dashed #304236;border-radius:14px;padding:18px;text-align:center;margin:0 0 24px">
      <p style="margin:0 0 6px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#5d6a5f">your code</p>
      <p style="margin:0;font-size:26px;font-weight:700;letter-spacing:2px">%s</p>
    </div>
    <a href="https://buynormie.com/#order" style="display:inline-block;background:#304236;color:#f6f1e8;text-decoration:none;font-size:15px;padding:14px 28px;border-radius:100px">shop the box</a>
    <p style="margin:28px 0 0;font-size:13px;line-height:1.5;color:#7d877e">Your code is also saved in your normie account. One use per customer.</p>
  </div>
  <p style="max-width:480px;margin:18px auto 0;text-align:center;font-size:12px;color:#7d877e">normie. · a little ritual. all yours. · buynormie.com</p>
</div>$h$, r.percent_off, r.code);

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    body := jsonb_build_object(
      'from', 'normie <hello@buynormie.com>',
      'to', jsonb_build_array(r.email),
      'subject', 'welcome to normie.',
      'html', html,
      'text', format(E'welcome to normie.\n\nThanks for joining. Here is %s%% off your first box: 4 matcha, 4 a\u00e7a\u00ed and 4 coffee sticks. Every box you order also earns a rewards stamp, and 5 stamps get you a free box.\n\nYour code: %s\n\nShop the box: https://buynormie.com/#order\n\nYour code is also saved in your normie account. One use per customer.\n\nnormie. a little ritual. all yours. buynormie.com', r.percent_off, r.code),
      'reply_to', 'hello@buynormie.com',
      -- arrive about 30 seconds after the sign-in email so it lands as its own fresh message
      'scheduled_at', to_char((now() + interval '30 seconds') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || k,
      'Content-Type', 'application/json',
      'Idempotency-Key', 'welcome-' || p_user::text)
  );
  update public.welcome_codes set emailed_at = now() where user_id = p_user;
end;
$$;
revoke all on function public.send_welcome_email(uuid) from public, anon, authenticated;

create or replace function public.on_first_sign_in()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.email is not null and new.email_confirmed_at is not null
     and (tg_op = 'INSERT' or old.email_confirmed_at is null) then
    insert into public.welcome_codes (user_id, email, code)
    values (new.id, lower(new.email), 'WELCOME-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)))
    on conflict (user_id) do nothing;
    perform public.send_welcome_email(new.id);
  end if;
  return new;
exception when others then
  -- never block sign-in because of the welcome email
  raise warning 'welcome email failed for %: %', new.id, sqlerrm;
  return new;
end;
$$;
revoke all on function public.on_first_sign_in() from public, anon, authenticated;

drop trigger if exists normie_first_sign_in_upd on auth.users;
create trigger normie_first_sign_in_upd
  after update of email_confirmed_at on auth.users
  for each row execute function public.on_first_sign_in();
drop trigger if exists normie_first_sign_in_ins on auth.users;
create trigger normie_first_sign_in_ins
  after insert on auth.users
  for each row execute function public.on_first_sign_in();
