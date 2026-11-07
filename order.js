// Accounts (passwordless email sign-in), email list, rewards and Stripe checkout.
// Backend: Supabase (auth + database with Row Level Security) and Stripe (via Supabase Edge Functions).
// Until supabaseUrl and supabaseAnonKey are set in config.js, everything runs in preview mode and sends nothing.
import { brand } from './config.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const GOAL = brand.rewardsGoal || 5;
const live = Boolean(brand.supabaseUrl && brand.supabaseAnonKey && window.supabase?.createClient);
const sb = live ? window.supabase.createClient(brand.supabaseUrl, brand.supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
}) : null;
const HOME = new URL('./', import.meta.url).href;
let session = null;

const validEmail = v => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) && v.length <= 254;
const money = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: brand.currency || 'USD' }).format(n);

/* ---------- price ---------- */
const totalEl = $('[data-summary-total]');
if (totalEl && typeof brand.boxPrice === 'number') totalEl.textContent = money(brand.boxPrice);

/* ---------- toast ---------- */
function toast(msg) {
  let t = $('.site-toast');
  if (!t) { t = document.createElement('div'); t.className = 'site-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 4200);
}

/* ---------- sign-in link ---------- */
async function sendLink(email, source) {
  await sb.rpc('subscribe', { p_email: email, p_source: source });
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: HOME, shouldCreateUser: true } });
  if (error) throw error;
}

/* ---------- rewards card ---------- */
async function renderRewards() {
  const member = $('[data-rewards-member]'), progress = $('[data-rewards-progress]'), stamps = $$('[data-stamp]');
  let n = 0, code = null;
  if (sb && session) {
    const { data } = await sb.rpc('my_rewards', { p_goal: GOAL });
    const r = Array.isArray(data) ? data[0] : data;
    if (r) { n = r.stamps || 0; code = r.open_code; }
    if (member) member.textContent = session.user.email;
  }
  stamps.forEach((s, i) => s.classList.toggle('filled', i < n));
  if (progress) {
    const left = GOAL - n;
    progress.textContent = code ? `free box ready · applied at checkout` : `${left} ${left === 1 ? 'box' : 'boxes'} to your free box`;
  }
  return { n, code };
}

/* ---------- rewards forms (section + popup) ---------- */
$$('[data-rewards-form]').forEach(form => {
  const status = $('[data-rewards-status]', form), input = $('input[type=email]', form), btn = $('button[type=submit]', form);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email = input.value.trim().toLowerCase();
    if (!validEmail(email)) { input.setAttribute('aria-invalid', 'true'); status.textContent = 'Enter a valid email address, like you@email.com.'; input.focus(); return; }
    input.removeAttribute('aria-invalid');
    if (!sb) { status.textContent = 'Preview only: rewards aren’t connected yet, so nothing was sent.'; return; }
    btn.disabled = true; status.textContent = 'Sending…';
    try {
      await sendLink(email, form.closest('[data-rewards-pop]') ? 'popup' : 'rewards');
      status.textContent = `Check ${email} for a link to finish joining. It signs you in and starts your rewards card.`;
      try { sessionStorage.setItem('normie-rewards-pop', 'closed'); } catch (err) {}
    } catch (err) {
      status.textContent = /rate|security/i.test(err?.message || '') ? 'Too many tries. Wait a minute, then try again.' : 'That didn’t go through. Try again in a moment.';
    } finally { btn.disabled = false; }
  });
});

/* ---------- account dialog ---------- */
const dlg = $('[data-account]');
const accountBtns = $$('[data-account-open]');
async function renderAccount() {
  accountBtns.forEach(b => { b.textContent = session ? 'account' : 'sign in'; });
  if (!dlg) return;
  $('[data-account-out]', dlg).hidden = Boolean(session);
  $('[data-account-in]', dlg).hidden = !session;
  if (!session) return;
  $('[data-account-email]', dlg).textContent = session.user.email;
  const { n, code } = await renderRewards();
  $('[data-account-stamps]', dlg).textContent = code ? 'Your free box is ready. It’s applied automatically at checkout.' : `${n} of ${GOAL} stamps. ${GOAL - n} more ${GOAL - n === 1 ? 'box' : 'boxes'} to a free box.`;
  const { data: wc } = await sb.from('welcome_codes').select('code, percent_off, redeemed_at').maybeSingle();
  const wBlock = $('[data-account-welcome]', dlg);
  if (wc && !wc.redeemed_at) {
    $('[data-account-welcome-text]', dlg).textContent = `${wc.percent_off}% off your first box with code`;
    $('[data-account-code]', dlg).textContent = wc.code;
    wBlock.hidden = false;
  } else wBlock.hidden = true;
  const list = $('[data-account-orders]', dlg);
  const { data: orders } = await sb.from('orders').select('created_at, boxes, amount_total, currency, free_box').order('created_at', { ascending: false }).limit(20);
  list.replaceChildren(...(orders?.length ? orders.map(o => {
    const li = document.createElement('li');
    const d = new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    li.textContent = `${d} · ${o.boxes} ${o.boxes === 1 ? 'box' : 'boxes'} · ${o.free_box ? 'free box' : new Intl.NumberFormat('en-US', { style: 'currency', currency: (o.currency || 'usd').toUpperCase() }).format(o.amount_total / 100)}`;
    return li;
  }) : [Object.assign(document.createElement('li'), { className: 'muted', textContent: 'No orders yet.' })]));
}
accountBtns.forEach(b => b.addEventListener('click', () => { dlg?.showModal(); renderAccount(); }));
$$('[data-account-close]', dlg || document).forEach(b => b.addEventListener('click', () => dlg.close()));
dlg?.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
const signinForm = $('[data-signin-form]');
signinForm?.addEventListener('submit', async e => {
  e.preventDefault();
  const input = $('input[type=email]', signinForm), status = $('[data-signin-status]', signinForm), btn = $('button[type=submit]', signinForm);
  const email = input.value.trim().toLowerCase();
  if (!validEmail(email)) { input.setAttribute('aria-invalid', 'true'); status.textContent = 'Enter a valid email address.'; return; }
  input.removeAttribute('aria-invalid');
  if (!sb) { status.textContent = 'Preview only: accounts aren’t connected yet.'; return; }
  btn.disabled = true; status.textContent = 'Sending…';
  try { await sendLink(email, 'sign-in'); status.textContent = `Check ${email} for your sign-in link. You can close this window.`; }
  catch (err) { status.textContent = /rate|security/i.test(err?.message || '') ? 'Too many tries. Wait a minute, then try again.' : 'That didn’t go through. Try again in a moment.'; }
  finally { btn.disabled = false; }
});
$('[data-signout]')?.addEventListener('click', async () => { await sb?.auth.signOut(); dlg?.close(); toast('Signed out.'); });

/* ---------- checkout ---------- */
const checkout = $('[data-checkout]'), orderStatus = $('[data-order-status]');
checkout?.addEventListener('click', async () => {
  if (!sb) { orderStatus.textContent = 'Checkout isn’t connected yet. Nothing was charged.'; return; }
  checkout.disabled = true; orderStatus.textContent = 'Opening secure checkout…';
  try {
    const token = session?.access_token || brand.supabaseAnonKey;
    const r = await fetch(`${brand.supabaseUrl}/functions/v1/create-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: brand.supabaseAnonKey, Authorization: `Bearer ${token}` },
      body: '{}',
    });
    const out = await r.json().catch(() => ({}));
    if (r.status === 503) { orderStatus.textContent = 'Checkout opens at launch.'; return; }
    if (!r.ok || !out.url || !/^https:\/\/checkout\.stripe\.com\//.test(out.url)) throw new Error(out.error || 'no url');
    location.href = out.url;
  } catch (err) {
    orderStatus.textContent = 'Checkout didn’t open. Try again in a moment.';
  } finally { checkout.disabled = false; }
});

/* ---------- return from Stripe ---------- */
const params = new URLSearchParams(location.search);
if (params.has('checkout')) {
  const ok = params.get('checkout') === 'success';
  if (orderStatus) orderStatus.textContent = ok ? 'Order confirmed. A receipt is on its way to your email.' : 'Checkout was cancelled. Nothing was charged.';
  toast(ok ? 'Order confirmed. Thank you.' : 'Checkout cancelled.');
  history.replaceState(null, '', location.pathname + location.hash);
}

/* ---------- session ---------- */
if (sb) {
  sb.auth.onAuthStateChange((event, s) => {
    const wasSignedIn = Boolean(session); session = s;
    renderAccount(); renderRewards();
    if (event === 'SIGNED_IN' && !wasSignedIn) toast(`Signed in as ${s.user.email}. Check your inbox for your welcome code.`);
  });
} else {
  renderRewards();
}

/* ---------- first-visit rewards popup ---------- */
const pop = $('[data-rewards-pop]');
if (pop && typeof pop.showModal === 'function') {
  let dismissed = false;
  try { dismissed = sessionStorage.getItem('normie-rewards-pop') === 'closed'; } catch (e) {}
  const video = $('video', pop);
  const close = () => { pop.classList.add('closing'); setTimeout(() => { pop.close(); pop.classList.remove('closing'); }, 200); };
  pop.addEventListener('close', () => { try { sessionStorage.setItem('normie-rewards-pop', 'closed'); } catch (e) {} video?.pause(); });
  $$('[data-pop-close]', pop).forEach(b => b.addEventListener('click', close));
  pop.addEventListener('click', e => { if (e.target === pop) close(); });
  setTimeout(() => {
    if (dismissed || session || params.has('checkout') || document.querySelector('dialog[open]')) return;
    pop.showModal();
    if (video && !matchMedia('(prefers-reduced-motion: reduce)').matches) video.play().catch(() => {});
  }, 700);
}
