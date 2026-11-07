# normie. backend setup

Stack: GitHub Pages (site) + Supabase (accounts, email list, orders, rewards) + Stripe (payments).
Secrets live only in Supabase Edge Function secrets. The site holds only the public Supabase URL and anon key.

## 1. Supabase project
1. Create a project at supabase.com (region: US East or US Central).
2. SQL Editor: run `backend/schema.sql`.
3. Authentication > URL Configuration
   - Site URL: `https://buynormie.com`
   - Redirect URLs: `https://buynormie.com/**`, `https://www.buynormie.com/**`
4. Authentication > Sign In / Providers > Email: enabled, "Confirm email" on.
5. Authentication > Emails > SMTP: connect a sending service (Resend, Postmark, SendGrid).
   Supabase's built-in mailer only delivers to your own team's addresses and a few per hour.
6. Settings > API: copy the Project URL and the anon public key into `config.js`
   (`supabaseUrl`, `supabaseAnonKey`). Never copy the service_role key anywhere.

## 2. Stripe
1. Product "the normie box" with a one-time price. Copy the price ID (`price_...`).
2. Coupon "free normie box": 100% off, duration once. Copy the coupon ID.
3. Developers > Webhooks > Add endpoint:
   `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
   Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`.
   Copy the signing secret (`whsec_...`).

## 3. Edge Functions (Supabase > Edge Functions)
- `create-checkout`: code in `backend/functions/create-checkout/index.ts`, Verify JWT OFF
  (guests can check out; the function verifies a signed-in user's token itself).
- `stripe-webhook`: code in `backend/functions/stripe-webhook/index.ts`, Verify JWT OFF
  (Stripe signs its requests; the function verifies that signature).

Secrets (Edge Functions > Secrets), entered by the account owner:
| name | value |
|---|---|
| STRIPE_SECRET_KEY | `sk_live_...` (or `sk_test_...` while testing) |
| STRIPE_PRICE_ID | `price_...` |
| STRIPE_WEBHOOK_SECRET | `whsec_...` |
| STRIPE_FREE_BOX_COUPON | coupon ID |
| SITE_URL | `https://buynormie.com` |
| REWARDS_GOAL | `5` |

## Security notes
- Row Level Security on every table. The browser can: add an email to the list (no read-back),
  read its own orders and reward codes after signing in. Nothing else.
- Orders are written only by `stripe-webhook` after Stripe's signature check, so they can't be faked.
- `create-checkout` only accepts requests from buynormie.com, verifies the signed-in user server-side,
  and the price comes from the Stripe price ID, never from the browser.
- Sign-in is passwordless (email link, PKCE flow): no passwords stored or to leak.
- Content-Security-Policy meta tag limits scripts to the site itself and network calls to Supabase.
- Test everything with Stripe test keys first, then swap to live keys.
