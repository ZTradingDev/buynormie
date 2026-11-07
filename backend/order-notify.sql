-- Order notification: every new row in public.orders emails the normie team.
-- Works with any payment processor: whatever writes the paid order into public.orders triggers it.
-- Sent through Resend using the Vault secret resend_api_key (same key as the welcome email).

-- Box details stored on each order.
alter table public.orders add column if not exists pack_size     integer check (pack_size in (6, 12));
alter table public.orders add column if not exists pack_name     text;       -- 'the normie special', '6-pack', '12-pack'
alter table public.orders add column if not exists mix           jsonb;      -- {"matcha":4,"acai":4,"coffee":4}
alter table public.orders add column if not exists customer_name text;
alter table public.orders add column if not exists shipping      jsonb;      -- {"line1","line2","city","state","postal_code","country"}
alter table public.orders add column if not exists notified_at   timestamptz;

create or replace function public.html_esc(t text)
returns text language sql immutable as $$
  select replace(replace(replace(replace(replace(coalesce(t, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;');
$$;

create or replace function public.send_order_email(o public.orders)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  k text;
  to_addr constant text := 'normieszn@gmail.com';
  total text;
  box text;
  addr text;
  html text;
  plain text;
begin
  select decrypted_secret into k from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  if k is null or k = '' then return; end if;

  total := case when o.free_box then 'free box (reward)'
                else '$' || to_char(coalesce(o.amount_total, 0) / 100.0, 'FM999990.00') || ' ' || upper(coalesce(o.currency, 'usd')) end;
  box := coalesce(nullif(o.pack_name, ''), o.pack_size::text || '-pack', o.boxes::text || ' box(es)')
         || case when o.mix is null then '' else ': '
              || coalesce((o.mix ->> 'matcha')::int, 0) || ' matcha, '
              || coalesce((o.mix ->> 'acai')::int, 0)   || ' açaí, '
              || coalesce((o.mix ->> 'coffee')::int, 0) || ' tiramisu coffee' end;
  addr := case when o.shipping is null then 'not provided'
               else concat_ws(', ', nullif(o.shipping ->> 'line1', ''), nullif(o.shipping ->> 'line2', ''),
                              nullif(o.shipping ->> 'city', ''),
                              nullif(trim(concat_ws(' ', o.shipping ->> 'state', o.shipping ->> 'postal_code')), ''),
                              nullif(o.shipping ->> 'country', '')) end;

  html := format($h$<div style="font-family:Helvetica,Arial,sans-serif;color:#304236;background:#f6f1e8;padding:28px 14px">
  <div style="max-width:520px;margin:0 auto;background:#fbf8f2;border:1px solid #e3dccf;border-radius:16px;padding:28px">
    <p style="margin:0 0 4px;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#5d6a5f">new order</p>
    <h1 style="margin:0 0 20px;font-size:24px;font-weight:600">#%s · %s</h1>
    <table style="width:100%%;border-collapse:collapse;font-size:15px;line-height:1.5">
      <tr><td style="padding:6px 0;color:#5d6a5f;width:120px">Box</td><td style="padding:6px 0">%s</td></tr>
      <tr><td style="padding:6px 0;color:#5d6a5f">Total</td><td style="padding:6px 0">%s</td></tr>
      <tr><td style="padding:6px 0;color:#5d6a5f">Customer</td><td style="padding:6px 0">%s</td></tr>
      <tr><td style="padding:6px 0;color:#5d6a5f">Email</td><td style="padding:6px 0">%s</td></tr>
      <tr><td style="padding:6px 0;color:#5d6a5f">Ship to</td><td style="padding:6px 0">%s</td></tr>
      <tr><td style="padding:6px 0;color:#5d6a5f">Status</td><td style="padding:6px 0">%s</td></tr>
      <tr><td style="padding:6px 0;color:#5d6a5f">Placed</td><td style="padding:6px 0">%s</td></tr>
      <tr><td style="padding:6px 0;color:#5d6a5f">Payment ref</td><td style="padding:6px 0;font-size:13px">%s</td></tr>
    </table>
    <p style="margin:20px 0 0;font-size:13px;color:#7d877e">Reply to this email to reach the customer.</p>
  </div>
</div>$h$,
    o.id, html_esc(coalesce(nullif(o.pack_name, ''), o.pack_size::text || '-pack', 'order')), html_esc(box), html_esc(total),
    html_esc(coalesce(nullif(o.customer_name, ''), '-')), html_esc(o.email), html_esc(addr), html_esc(o.status),
    to_char(o.created_at at time zone 'America/Chicago', 'Mon DD, YYYY HH12:MI AM') || ' CT', html_esc(o.stripe_session_id));

  plain := format(E'New order #%s\n\nBox: %s\nTotal: %s\nCustomer: %s\nEmail: %s\nShip to: %s\nStatus: %s\nPlaced: %s CT\nPayment ref: %s\n\nReply to this email to reach the customer.',
    o.id, box, total, coalesce(nullif(o.customer_name, ''), '-'), o.email, addr, o.status,
    to_char(o.created_at at time zone 'America/Chicago', 'Mon DD, YYYY HH12:MI AM'), o.stripe_session_id);

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    body := jsonb_build_object(
      'from', 'normie orders <orders@buynormie.com>',
      'to', jsonb_build_array(to_addr),
      'reply_to', o.email,
      'subject', format('new order #%s · %s · %s', o.id, coalesce(nullif(o.pack_name, ''), o.pack_size::text || '-pack', 'box'), total),
      'html', html,
      'text', plain),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || k,
      'Content-Type', 'application/json',
      'Idempotency-Key', 'order-' || o.id::text)
  );
end;
$$;
revoke all on function public.send_order_email(public.orders) from public, anon, authenticated;

create or replace function public.on_new_order()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.send_order_email(new);
  update public.orders set notified_at = now() where id = new.id;
  return new;
exception when others then
  -- never lose an order because the notification failed
  raise warning 'order email failed for %: %', new.id, sqlerrm;
  return new;
end;
$$;
revoke all on function public.on_new_order() from public, anon, authenticated;

drop trigger if exists normie_new_order on public.orders;
create trigger normie_new_order
  after insert on public.orders
  for each row execute function public.on_new_order();
