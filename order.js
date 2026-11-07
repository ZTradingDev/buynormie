// One product: the normie box (12 sticks, 4 of each flavor). Hands off to a hosted checkout.
import { brand } from './config.js';

const panel = document.querySelector('.order-panel');
if (panel) {
  const total = panel.querySelector('[data-summary-total]');
  const status = panel.querySelector('[data-order-status]');
  let checkout = panel.querySelector('[data-checkout]');
  if (typeof brand.boxPrice === 'number') {
    total.textContent = new Intl.NumberFormat('en-US', { style: 'currency', currency: brand.currency || 'USD' }).format(brand.boxPrice);
  }
  if (brand.checkoutUrl) {
    const a = document.createElement('a');
    a.className = checkout.className; a.innerHTML = checkout.innerHTML;
    a.href = brand.checkoutUrl; a.target = '_blank'; a.rel = 'noopener';
    checkout.replaceWith(a); checkout = a;
    status.textContent = 'Checkout opens in a new tab.';
  } else {
    checkout.addEventListener('click', () => {
      status.textContent = 'Checkout isn’t connected yet. Nothing was charged.';
    });
  }
}

// Rewards: email sign-up + stamp card (section and first-visit popup).
// Stamps come from real orders once checkout and a loyalty service are connected.
const forms = [...document.querySelectorAll('[data-rewards-form]')];
if (forms.length) {
  const goal = brand.rewardsGoal || 5;
  const member = document.querySelector('[data-rewards-member]');
  const progress = document.querySelector('[data-rewards-progress]');
  const stamps = [...document.querySelectorAll('[data-stamp]')];
  const pop = document.querySelector('[data-rewards-pop]');
  const KEY = 'normie-rewards';
  let state = null;
  try { state = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  const render = () => {
    const n = state ? Math.min(goal, state.boxes || 0) : 0;
    stamps.forEach((s, i) => s.classList.toggle('filled', i < n));
    if (state && member) member.textContent = state.email;
    const left = goal - n;
    if (progress) progress.textContent = left > 0 ? `${left} ${left === 1 ? 'box' : 'boxes'} to your free box` : 'your next box is free';
  };
  forms.forEach(form => {
    const status = form.querySelector('[data-rewards-status]');
    const input = form.querySelector('input[type=email]');
    if (state) input.value = state.email;
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const email = input.value.trim();
      if (!input.checkValidity() || !email) { input.setAttribute('aria-invalid', 'true'); status.textContent = 'Enter a valid email address, like you@email.com.'; input.focus(); return; }
      input.removeAttribute('aria-invalid');
      if (brand.rewardsEndpoint) {
        try {
          const url = new URL(brand.rewardsEndpoint, location.origin);
          const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
          if (!r.ok) throw new Error();
          status.textContent = 'You’re in. Your first stamp arrives with your first box.';
        } catch (err) { status.textContent = 'Sign-up didn’t go through. Try again in a moment.'; return; }
      } else {
        status.textContent = 'Preview only: rewards sign-up isn’t connected yet, so nothing was sent. Your card is saved on this device.';
      }
      state = { email, boxes: state?.boxes || 0 };
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (err) {}
      forms.forEach(f => { f.querySelector('input[type=email]').value = email; });
      render();
      if (pop && pop.open) { const skip = pop.querySelector('.rewards-pop-skip'); if (skip) skip.textContent = 'keep browsing'; }
    });
  });
  render();

  // first thing a visitor sees: once per browser session until they join
  if (pop && typeof pop.showModal === 'function') {
    let dismissed = false;
    try { dismissed = sessionStorage.getItem('normie-rewards-pop') === 'closed'; } catch (e) {}
    const video = pop.querySelector('video');
    const close = () => { pop.classList.add('closing'); setTimeout(() => { pop.close(); pop.classList.remove('closing'); }, 200); };
    pop.addEventListener('close', () => { try { sessionStorage.setItem('normie-rewards-pop', 'closed'); } catch (e) {} video && video.pause(); });
    pop.querySelectorAll('[data-pop-close]').forEach(b => b.addEventListener('click', close));
    pop.addEventListener('click', e => { if (e.target === pop) close(); });
    if (!state && !dismissed) {
      setTimeout(() => {
        if (document.querySelector('dialog[open]')) return;
        pop.showModal();
        if (video && !matchMedia('(prefers-reduced-motion: reduce)').matches) video.play().catch(() => {});
      }, 500);
    }
  }
}
