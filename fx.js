// Extra motion for the home page: hero color blobs with pointer parallax, and sticks that fly into the box.
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ROOT = new URL('./', import.meta.url).href;

// hero blobs follow the pointer a little
const hero = document.querySelector('.pop-hero');
const blobs = hero ? [...hero.querySelectorAll('.hero-blobs span')] : [];
if (hero && blobs.length && !reduced && matchMedia('(pointer: fine)').matches) {
  let tx = 0, ty = 0, x = 0, y = 0, raf = 0;
  const tick = () => { x += (tx - x) * 0.06; y += (ty - y) * 0.06; blobs.forEach((b, i) => { const d = (i + 1) * 18; b.style.translate = `${x * d}px ${y * d}px`; }); raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.001 ? requestAnimationFrame(tick) : 0; };
  hero.addEventListener('pointermove', e => { const r = hero.getBoundingClientRect(); tx = (e.clientX - r.left) / r.width - 0.5; ty = (e.clientY - r.top) / r.height - 0.5; if (!raf) raf = requestAnimationFrame(tick); });
}

// a stick flies from the + button into its slot
if (!reduced) document.addEventListener('click', e => {
  const btn = e.target.closest('.order-row [data-step="1"]');
  if (!btn || btn.disabled) return;
  const k = btn.closest('[data-flavor]')?.dataset.flavor;
  requestAnimationFrame(() => {
    const slots = document.querySelectorAll(`[data-box-slots] .slot-${k}`);
    const slot = slots[slots.length - 1];
    if (!slot) return;
    const a = btn.getBoundingClientRect(), b = slot.getBoundingClientRect();
    const img = new Image(); img.src = `${ROOT}assets/stick-${k}.webp`; img.alt = ''; img.className = 'fly-stick';
    const h = 64, w = h * 0.23;
    Object.assign(img.style, { left: `${a.left + a.width / 2 - w / 2}px`, top: `${a.top + a.height / 2 - h / 2}px`, width: `${w}px`, height: `${h}px` });
    document.body.appendChild(img);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const s = Math.max(0.3, b.height / h);
    slot.classList.add('slot-incoming');
    img.animate([
      { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 90}px) rotate(200deg) scale(1.15)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) rotate(360deg) scale(${s})`, opacity: 0.2 },
    ], { duration: 620, easing: 'cubic-bezier(.3,.7,.2,1)' }).finished.then(() => {
      img.remove(); slot.classList.remove('slot-incoming'); slot.classList.add('slot-pop');
      setTimeout(() => slot.classList.remove('slot-pop'), 450);
    });
  });
});
