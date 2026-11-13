// Loads the 3D studio (three.js, ~1.3 MB) right away on desktop.
// On phones and touch screens, shows a static image first and loads 3D only when tapped.
const V = '?v=20261113a';
const ROOT = new URL('./', import.meta.url).href;
const studios = [...document.querySelectorAll('[data-studio]')];
const small = matchMedia('(max-width: 800px), (hover: none) and (pointer: coarse)').matches;
const load = () => import(`./studio3d.js${V}`);

if (!small) load();
else if (!studios.length) { /* phones skip three.js on pages without a 3D view */ }
else {
  let started = false;
  const start = () => {
    if (started) return; started = true;
    studios.forEach(s => s.classList.add('studio-loading'));
    load().then(() => studios.forEach(s => { s.classList.remove('studio-poster-mode', 'studio-loading'); s.querySelector('.studio-poster')?.remove(); }))
      .catch(() => studios.forEach(s => { s.classList.remove('studio-loading'); const b = s.querySelector('.studio-poster span'); if (b) b.textContent = '3D view unavailable'; }));
  };
  studios.forEach(s => {
    const stage = s.querySelector('.studio-stage');
    if (!stage) return;
    s.classList.add('studio-poster-mode');
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'studio-poster';
    b.setAttribute('aria-label', 'Load the interactive 3D view of the normie drink sticks');
    b.innerHTML = `<img src="${ROOT}assets/sticks-3d.webp" alt="" width="900" height="796" decoding="async"><span>tap to view in 3D</span>`;
    b.addEventListener('click', start);
    stage.appendChild(b);
    s.querySelector('[data-studio-pour]')?.addEventListener('click', start, { once: true });
  });
}
