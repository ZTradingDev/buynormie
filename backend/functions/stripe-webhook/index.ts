// Supabase Edge Function: stripe-webhook
// Receives Stripe events, verifies the signature, records paid orders and issues free-box codes.
// Deploy with "Verify JWT" turned OFF (Stripe does not send a Supabase token); the Stripe
// signature check below is what authenticates the request.
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_FREE_BOX_COUPON, REWARDS_GOAL (default 5)
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', { httpClient: Stripe.createFetchHttpClient() });
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const GOAL = Math.max(1, Number(Deno.env.get('REWARDS_GOAL') ?? 5));

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature ?? '', Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '', undefined, cryptoProvider);
  } catch (err) {
    console.warn('bad signature', err);
    return new Response('invalid signature', { status: 400 });
  }

  if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.async_payment_succeeded') {
    return new Response('ignored', { status: 200 });
  }
  const s = event.data.object as Stripe.Checkout.Session;
  if (s.payment_status !== 'paid') return new Response('not paid yet', { status: 200 });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const email = (s.customer_details?.email ?? s.customer_email ?? '').toLowerCase();
  if (!email) return new Response('no email', { status: 200 });
  const rewardCode = s.metadata?.reward_code || '';
  const boxes = Math.min(50, Math.max(1, Number(s.metadata?.boxes ?? 1)));
  const freeBox = Boolean(rewardCode) && (s.amount_total ?? 0) === 0;

  // Idempotent: Stripe can deliver the same event more than once.
  const { error: insertError } = await db.from('orders').upsert({
    stripe_session_id: s.id,
    user_id: s.metadata?.user_id || null,
    email,
    boxes,
    amount_total: s.amount_total ?? 0,
    currency: s.currency ?? 'usd',
    free_box: freeBox,
    status: 'paid',
  }, { onConflict: 'stripe_session_id', ignoreDuplicates: true });
  if (insertError) { console.error(insertError); return new Response('db error', { status: 500 }); }

  if (rewardCode) await db.from('reward_codes').update({ redeemed_at: new Date().toISOString() }).eq('code', rewardCode).is('redeemed_at', null);

  // Issue a free-box code each time paid boxes cross a multiple of GOAL.
  const coupon = Deno.env.get('STRIPE_FREE_BOX_COUPON');
  if (coupon && !freeBox) {
    const { data: rows } = await db.from('orders').select('boxes, free_box').eq('email', email).eq('status', 'paid');
    const paid = (rows ?? []).filter((r) => !r.free_box).reduce((a, r) => a + r.boxes, 0);
    const earned = Math.floor(paid / GOAL);
    const { count } = await db.from('reward_codes').select('id', { count: 'exact', head: true }).eq('email', email);
    for (let i = count ?? 0; i < earned; i++) {
      const code = `NORMIE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const promo = await stripe.promotionCodes.create({ coupon, code, max_redemptions: 1, metadata: { email } });
      await db.from('reward_codes').insert({ email, code, stripe_promo_id: promo.id });
    }
  }
  return new Response('ok', { status: 200 });
});
