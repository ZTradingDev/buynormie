// Accounts (passwordless email sign-in), email list, rewards and Stripe checkout.
// Backend: Supabase (auth + database with Row Level Security) and Stripe (via Supabase Edge Functions).
// Until supabaseUrl and supabaseAnonKey are set in config.js, everything runs in preview mode and sends nothing.
import { brand } from './config.js?v=20261107e';

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

/* ---------- build your box: the normie special (set), or a 6- / 12-pack mixed per flavor ---------- */
const FLAVORS = ['matcha', 'acai', 'coffee'];
const NAMES = { matcha: 'matcha', acai: 'açaí', coffee: 'tiramisu coffee' };
const PACKS = {
  special: { size: 12, label: 'the normie special', price: brand.specialPrice, fixed: { matcha: 4, acai: 4, coffee: 4 } },
  6: { size: 6, label: '6-pack', price: brand.pack6Price },
  12: { size: 12, label: '12-pack', price: brand.pack12Price },
};
const even = size => { const base = Math.floor(size / 3); const m = { matcha: base, acai: base, coffee: base }; for (let i = 0; i < size - base * 3; i++) m[FLAVORS[i]]++; return m; };
const box = { pack: 'special', mix: { ...PACKS.special.fixed } };
try {
  const saved = JSON.parse(localStorage.getItem('normie-box') || 'null');
  if (saved && PACKS[saved.pack]) {
    box.pack = saved.pack;
    const P = PACKS[box.pack];
    if (P.fixed) box.mix = { ...P.fixed };
    else if (saved.mix && FLAVORS.reduce((a, k) => a + (saved.mix[k] | 0), 0) <= P.size) FLAVORS.forEach(k => { box.mix[k] = Math.max(0, saved.mix[k] | 0); });
    else box.mix = even(P.size);
  }
} catch (e) {}
const pack = () => PACKS[box.pack];
Object.defineProperty(box, 'size', { get: () => pack().size, enumerable: false });
const picked = () => FLAVORS.reduce((a, k) => a + box.mix[k], 0);
const mixText = () => FLAVORS.filter(k => box.mix[k] > 0).map(k => `${box.mix[k]} ${NAMES[k]}`).join(', ') || 'no sticks yet';
const packText = () => `${pack().label} · ${mixText()}`;
function renderBox() {
  const P = pack(), n = picked(), left = P.size - n, fixed = Boolean(P.fixed);
  $$('[data-pack]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.pack === box.pack)));
  $$('[data-pack-price]').forEach(el => { const p = PACKS[el.dataset.packPrice]?.price; el.textContent = typeof p === 'number' ? money(p) : 'price at launch'; });
  $('#order')?.classList.toggle('is-set', fixed);
  $$('.order-row[data-flavor]').forEach(r => {
    const k = r.dataset.flavor;
    $('[data-qty]', r).textContent = box.mix[k];
    $('[data-step="-1"]', r).disabled = fixed || box.mix[k] === 0;
    $('[data-step="1"]', r).disabled = fixed || left === 0;
    r.classList.toggle('in-box', box.mix[k] > 0);
  });
  const prog = $('[data-mix-progress]');
  if (prog) {
    prog.textContent = fixed ? 'set box · 4 of each flavor · 12 sticks'
      : left === 0 ? `${P.size} of ${P.size} sticks picked · your box is full` : `${n} of ${P.size} sticks picked · ${left} to go`;
    prog.classList.toggle('full', left === 0);
  }
  const ev = $('[data-mix-even]'); if (ev) ev.hidden = fixed;
  const sum = $('[data-mix-summary]'); if (sum) sum.textContent = packText();
  const tot = $('[data-summary-total]'); if (tot) tot.textContent = typeof P.price === 'number' ? money(P.price) : 'price at launch';
  const btn = $('[data-checkout]');
  if (btn) { btn.classList.toggle('is-empty', left !== 0); btn.setAttribute('aria-disabled', String(left !== 0)); }
  // savings vs. buying the same number of sticks at the 6-pack rate (only once prices are set)
  const per6 = typeof PACKS[6].price === 'number' ? PACKS[6].price / 6 : null;
  $$('[data-pack]').forEach(el => {
    const Q = PACKS[el.dataset.pack]; let tag = $('.pack-save', el);
    const save = per6 && typeof Q.price === 'number' ? per6 * Q.size - Q.price : 0;
    if (save > 0.5) { if (!tag) { tag = document.createElement('span'); tag.className = 'pack-save'; el.appendChild(tag); } tag.textContent = `you save ${money(save)}`; }
    else tag?.remove();
  });
  // slot view: one cell per stick
  const slots = $('[data-box-slots]');
  if (slots) {
    const cells = [];
    FLAVORS.forEach(k => { for (let i = 0; i < box.mix[k]; i++) cells.push(k); });
    while (cells.length < P.size) cells.push(null);
    slots.className = `box-slots size-${P.size}`;
    slots.replaceChildren(...cells.map((k, i) => {
      const li = document.createElement('li');
      if (k) {
        li.className = `slot slot-${k}`;
        if (fixed) li.innerHTML = `<span class="sr-only">${NAMES[k]}</span>`;
        else {
          const b = document.createElement('button'); b.type = 'button'; b.dataset.removeStick = k;
          b.setAttribute('aria-label', `Remove one ${NAMES[k]} stick`); b.title = `${NAMES[k]} · tap to remove`;
          li.appendChild(b);
        }
      } else { li.className = 'slot slot-empty'; li.innerHTML = '<span class="sr-only">empty</span>'; }
      return li;
    }));
  }
  // sticky bar
  const sn = $('[data-sticky-name]'); if (sn) sn.textContent = P.label;
  const sm = $('[data-sticky-mix]'); if (sm) sm.textContent = left === 0 ? mixText() : `${n} of ${P.size} picked · ${left} to go`;
  const sp = $('[data-sticky-price]'); if (sp) sp.textContent = typeof P.price === 'number' ? money(P.price) : 'price at launch';
  try { localStorage.setItem('normie-box', JSON.stringify({ pack: box.pack, mix: box.mix })); } catch (e) {}
}
$$('[data-pack]').forEach(b => b.addEventListener('click', () => {
  const k = b.dataset.pack; if (k === box.pack || !PACKS[k]) return;
  box.pack = k; box.mix = PACKS[k].fixed ? { ...PACKS[k].fixed } : even(PACKS[k].size); renderBox();
}));
$('[data-mix-even]')?.addEventListener('click', () => { if (pack().fixed) return; box.mix = even(box.size); renderBox(); });
$$('.order-row[data-flavor]').forEach(r => $$('[data-step]', r).forEach(b => b.addEventListener('click', () => {
  if (pack().fixed) return;
  const k = r.dataset.flavor, d = Number(b.dataset.step);
  if (d > 0 && picked() >= box.size) return;
  box.mix[k] = Math.max(0, box.mix[k] + d); renderBox();
})));
$('[data-box-slots]')?.addEventListener('click', e => {
  const t = e.target.closest('[data-remove-stick]'); if (!t || pack().fixed) return;
  const k = t.dataset.removeStick; if (box.mix[k] > 0) { box.mix[k]--; renderBox(); }
});
renderBox();

/* ---------- sticky order bar: shows once past the hero, hides while the order button is on screen ---------- */
(() => {
  const bar = $('[data-sticky-order]'), hero = $('.pop-hero'), order = $('#order .order-bar'), btn = $('[data-sticky-btn]');
  if (!bar || !hero || !order || !('IntersectionObserver' in window)) return;
  let pastHero = false, orderVisible = false;
  const sync = () => {
    const foot = document.querySelector('footer'), nearFoot = foot ? foot.getBoundingClientRect().top < innerHeight * 0.6 : false;
    const show = pastHero && !orderVisible && !nearFoot && !document.querySelector('dialog[open]');
    bar.classList.toggle('show', show); bar.setAttribute('aria-hidden', String(!show));
    btn.tabIndex = show ? 0 : -1;
  };
  new IntersectionObserver(([e]) => { pastHero = !e.isIntersecting && e.boundingClientRect.top < 0; sync(); }).observe(hero);
  new IntersectionObserver(([e]) => { orderVisible = e.isIntersecting; sync(); }, { threshold: 0.3 }).observe(order);
  btn.addEventListener('click', () => { order.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' }); });
  addEventListener('scroll', sync, { passive: true });
  setInterval(sync, 800);
})();

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
async function renderAccount() {
  document.querySelectorAll('[data-account-label]').forEach(b => { b.textContent = session ? 'account' : 'sign in'; });
  document.querySelectorAll('.account-pill').forEach(b => b.classList.toggle('signed-in', Boolean(session)));
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
function openAccount() {
  if (!dlg) return;
  document.querySelectorAll('dialog[open]').forEach(d => { if (d !== dlg) d.close(); });
  if (!dlg.open) dlg.showModal();
  renderAccount();
}
// delegated: header icon, mobile menu link, rewards section link
document.addEventListener('click', e => {
  const t = e.target.closest('[data-account-open]');
  if (!t || !dlg) return;
  e.preventDefault();
  openAccount();
});
if (location.hash === '#account') setTimeout(openAccount, 300);
addEventListener('hashchange', () => { if (location.hash === '#account') openAccount(); });
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
  if (picked() !== box.size) { orderStatus.textContent = `Pick ${box.size - picked()} more ${box.size - picked() === 1 ? 'stick' : 'sticks'} to fill your ${pack().label}.`; return; }
  if (!brand.checkoutLive) { orderStatus.textContent = `Checkout opens at launch. Saved on this device: ${pack().label} (${mixText()}).`; return; }
  if (!sb) { orderStatus.textContent = 'Checkout isn’t connected yet. Nothing was charged.'; return; }
  checkout.disabled = true; orderStatus.textContent = 'Opening secure checkout…';
  try {
    const token = session?.access_token || brand.supabaseAnonKey;
    const r = await fetch(`${brand.supabaseUrl}/functions/v1/create-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: brand.supabaseAnonKey, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ pack: box.pack, mix: box.mix }),
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
    if (event === 'SIGNED_IN' && !wasSignedIn) toast(`Signed in as ${s.user.email}.`);
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
    if (dismissed || session || location.hash === '#account' || params.has('checkout') || document.querySelector('dialog[open]')) return;
    pop.showModal();
    if (video && !matchMedia('(prefers-reduced-motion: reduce)').matches) video.play().catch(() => {});
  }, 700);
}
