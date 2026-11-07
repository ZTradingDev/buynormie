// Supabase Edge Function: create-checkout
// Creates a Stripe Checkout Session for one normie box and returns its URL.
// Secrets (set in Supabase > Edge Functions > Secrets, never in the site code):
//   STRIPE_SECRET_KEY, STRIPE_PRICE_ID, SITE_URL (https://buynormie.com)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', { httpClient: Stripe.createFetchHttpClient() });
const SITE = Deno.env.get('SITE_URL') ?? 'https://buynormie.com';
const ALLOWED = new Set([SITE, SITE.replace('https://', 'https://www.')]);

function cors(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED.has(origin) ? origin : SITE,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Vary': 'Origin',
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = { ...cors(origin), 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers });
  if (!origin || !ALLOWED.has(origin)) return new Response(JSON.stringify({ error: 'forbidden_origin' }), { status: 403, headers });

  const priceId = Deno.env.get('STRIPE_PRICE_ID');
  if (!priceId) return new Response(JSON.stringify({ error: 'checkout_not_configured' }), { status: 503, headers });

  try {
    // Optional signed-in customer: verify their token server-side, never trust the body.
    let email: string | undefined;
    let userId: string | undefined;
    const auth = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    if (auth) {
      const { data } = await admin.auth.getUser(auth);
      if (data?.user?.email) { email = data.user.email; userId = data.user.id; }
    }

    // Apply an unused free-box code automatically for signed-in customers.
    let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
    let rewardCode: string | undefined;
    if (email) {
      const { data: code } = await admin.from('reward_codes').select('code, stripe_promo_id')
        .eq('email', email.toLowerCase()).is('redeemed_at', null).order('created_at').limit(1).maybeSingle();
      if (code) { discounts = [{ promotion_code: code.stripe_promo_id }]; rewardCode = code.code; }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      ...(discounts ? { discounts } : { allow_promotion_codes: true }),
      shipping_address_collection: { allowed_countries: ['US'] },
      success_url: `${SITE}/?checkout=success#order`,
      cancel_url: `${SITE}/?checkout=cancelled#order`,
      metadata: { user_id: userId ?? '', reward_code: rewardCode ?? '', boxes: '1' },
    });
    return new Response(JSON.stringify({ url: session.url }), { headers });
  } catch (err) {
    console.error('create-checkout failed', err);
    return new Response(JSON.stringify({ error: 'checkout_failed' }), { status: 500, headers });
  }
});
