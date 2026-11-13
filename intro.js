// normie. scroll intro: a quiet, scroll-driven product reveal.
// wordmark -> the three pouches -> one stick rises from each -> each flavor named -> the three sticks
// settle into the same arrangement as the hero's 3D model, and the page carries on.
// Every frame is a pure function of scroll progress, so scrolling back rewinds exactly.
import * as THREE from './vendor/three.module.js';
import { FLAVORS, makePacket, BODY_H } from './packets3d.js';
import { makePouch, PH } from './pouch3d.js';
import { RoomEnvironment } from './vendor/three-addons/environments/RoomEnvironment.js';
import { track } from './api.js?v=20261112a';

const section = document.getElementById('hero-intro');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (section && reduced) section.remove();
else if (section) {
  const fonts = document.fonts ? Promise.all(['700 200px DM', '400 30px DM'].map(f => document.fonts.load(f))) : Promise.resolve();
  Promise.race([fonts, new Promise(r => setTimeout(r, 1500))]).then(() => boot(section));
}

function boot(section) {
  const $ = s => section.querySelector(s);
  const canvas = $('.intro-canvas');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { section.remove(); return; }
  const mobile = innerWidth < 800;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;

  try { if (localStorage.getItem('normie-intro-seen')) section.classList.add('intro-short'); } catch (e) {}

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);                       // gentle smoothstep, no overshoot
  const col = h => new THREE.Color(h);

  /* ---------- scene: soft neutrals only ---------- */
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const BG = { base: col('#efe8dc'), matcha: col('#e3e8d6'), acai: col('#f1e4e1'), coffee: col('#ecdfcd'), end: col('#efe6d6') };
  const bg = BG.base.clone(); scene.background = bg;
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.add(new THREE.HemisphereLight('#fff7ea', '#d9c9ad', 1.1));
  const sun = new THREE.DirectionalLight('#fff4e2', 1.5); sun.position.set(-3, 7, 4); scene.add(sun);

  // soft contact shadow under whatever is on stage
  const shadowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(90,70,45,.5)'); r.addColorStop(1, 'rgba(90,70,45,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0 }));
  shadow.rotation.x = -Math.PI / 2; scene.add(shadow);

  /* ---------- the three pouches ---------- */
  const keys = ['matcha', 'acai', 'coffee'];
  const pouches = keys.map(k => { const p = makePouch(k); scene.add(p); return p; });
  const FLOOR = -1.5;                       // pouch base height
  const pouchY = FLOOR + PH / 2;

  /* ---------- one stick per flavor ---------- */
  const sticks = keys.map(k => { const m = makePacket(k); scene.add(m); return m; });
  const STICK_IN = 0.52;                    // size while still inside the pouch

  /* ---------- layout ---------- */
  let W = 0, H = 0, portrait = false;
  function resize() {
    W = canvas.clientWidth; H = canvas.clientHeight; if (!W || !H) return;
    renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); portrait = W < H;
  }
  addEventListener('resize', resize);
  const gap = () => portrait ? 1.45 : 2.5;
  // the same arrangement as the hero's 3D model (studio3d.js rest pose)
  const heroPos = i => new THREE.Vector3((i - 1) * (portrait ? 0.95 : 1.3), 0.35, 0);
  const heroRotY = i => (i - 1) * -0.12, heroRotZ = i => (1 - i) * 0.06;

  /* ---------- overlay ---------- */
  const word = $('.intro-word'), prompt = $('.intro-scroll');
  const callouts = Object.fromEntries([...section.querySelectorAll('[data-callout]')].map(el => [el.dataset.callout, el]));
  const show = (el, o, t = '') => { el.style.opacity = o.toFixed(3); el.style.transform = t; el.style.visibility = o < .01 ? 'hidden' : 'visible'; };

  /* ---------- scroll ---------- */
  let target = 0, p = 0;
  const marks = new Set();
  function measure() {
    const r = section.getBoundingClientRect(); const total = r.height - innerHeight;
    target = total > 0 ? clamp(-r.top / total) : 0;
    for (const m of [25, 50, 75, 100]) if (target * 100 >= m - .5 && !marks.has(m)) { marks.add(m); track('intro_depth', String(m)); }
    if (target >= .999) { try { localStorage.setItem('normie-intro-seen', '1'); } catch (e) {} }
  }
  addEventListener('scroll', measure, { passive: true });
  $('.intro-skip').addEventListener('click', () => { track('intro_skip', String(Math.round(target * 100))); scrollTo({ top: section.getBoundingClientRect().top + scrollY + section.offsetHeight, behavior: 'auto' }); });

  /* ---------- timeline ---------- */
  const FOCUS = [['matcha', .56, .67], ['acai', .67, .78], ['coffee', .78, .89]];
  const v = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  function frame() {
    if (canvas.clientWidth !== W || canvas.clientHeight !== H) resize();
    const P = p;
    const enter = ease(seg(P, .10, .26));          // pouches drift in
    const turn = ease(seg(P, .24, .44));           // slow quarter turn
    const rise = ease(seg(P, .40, .56));           // one stick lifts out of each pouch
    const leave = ease(seg(P, .46, .60));          // pouches sink away
    const settle = ease(seg(P, .89, 1));           // sticks take the hero arrangement

    // background: stays in the same soft family, tinted by the flavor in focus
    bg.copy(BG.base);
    FOCUS.forEach(([k, s, e]) => bg.lerp(BG[k], ease(Math.sin(seg(P, s - .03, e + .03) * Math.PI))));
    bg.lerp(BG.end, settle);

    // camera: one slow push in, nothing else
    camera.position.set(0, lerp(.5, .35, turn), lerp(portrait ? 17 : 13.5, portrait ? 15 : 12, ease(seg(P, .1, .6))));
    camera.lookAt(0, .1, 0);

    // pouches
    pouches.forEach((pp, i) => {
      const o = i - 1;
      pp.visible = P > .08 && leave < 1;
      pp.position.set(o * gap(), pouchY + (1 - enter) * -7 + leave * -8, portrait && o === 0 ? .5 : 0);
      pp.rotation.set(0, o * -.12 + (1 - enter) * .35 + turn * -.5, 0);
    });

    // sticks
    sticks.forEach((m, i) => {
      const o = i - 1, [k, s, e] = FOCUS[i];
      m.visible = rise > 0;
      // start: front-row slot inside its pouch
      a.set(o * gap() + .2, FLOOR + .04 + 1.32 * STICK_IN, .13);
      // lifted: floating above where the pouch stood
      b.set(o * (portrait ? 1.0 : 1.9), .55, 0);
      v.copy(a).lerp(b, rise);
      let scale = lerp(STICK_IN, .86, rise), ry = lerp(-.5 + o * -.12, o * -.1, rise), rz = 0;
      // focus: the named flavor eases forward, the others ease back
      const w = ease(Math.sin(seg(P, s, e) * Math.PI));
      const any = FOCUS.reduce((mx, [, s2, e2]) => Math.max(mx, ease(Math.sin(seg(P, s2, e2) * Math.PI))), 0);
      const away = clamp(any - w);                 // another flavor is being named
      if (!portrait) {
        v.x = lerp(v.x, -1.7, w); v.z += w * 1.4; v.y -= w * .3;
        v.x = lerp(v.x, -5.0 + i * .7, away); v.z -= away * 2.5; v.y -= away * .2;
      } else {
        v.x = lerp(v.x, 0, w); v.z += w * 1.2; v.y -= w * .6;
        v.x = lerp(v.x, o * 1.5, away); v.z -= away * 4; v.y -= away * 1.6;
      }
      scale *= 1 + w * .22; ry += w * .22 * Math.sin(seg(P, s, e) * Math.PI * 2);
      // settle into the hero arrangement
      v.lerp(heroPos(i), settle); scale = lerp(scale, portrait ? .8 : 1, settle);
      ry = lerp(ry, heroRotY(i), settle); rz = lerp(rz, heroRotZ(i), settle);
      m.position.copy(v); m.rotation.set(0, ry, rz); m.scale.setScalar(scale);
    });

    // shadow follows the group on stage
    const onStage = enter * (1 - leave);
    shadow.position.set(0, FLOOR - .01, 0); shadow.scale.set(gap() * 3.8, 3.4, 1);
    shadow.material.opacity = onStage * .32;

    // overlay
    const ready = section.classList.contains('intro-ready') ? 1 : 0;
    show(word, ready * (1 - ease(seg(P, .05, .14))), 'translate(-50%,-50%)');
    show(prompt, ready * (1 - seg(P, .01, .05)));
    FOCUS.forEach(([k, s, e]) => { const w = ease(clamp(Math.sin(seg(P, s + .01, e - .01) * Math.PI) * 1.5)); show(callouts[k], w, `translateY(${((1 - w) * 12).toFixed(1)}px)`); });

    renderer.render(scene, camera);
  }

  /* ---------- loop ---------- */
  let visible = true, raf = 0, started = false;
  const loop = () => {
    p += (target - p) * .07;                        // slow, soft scrub
    if (Math.abs(target - p) < 1e-4) p = target;
    frame();
    if (!started) { started = true; requestAnimationFrame(() => section.classList.add('intro-ready')); }
    raf = visible ? requestAnimationFrame(loop) : 0;
  };
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; document.body.classList.toggle('intro-active', visible); if (visible && !raf) raf = requestAnimationFrame(loop); }).observe(section);
  window.__normieIntro = { set(x) { target = p = clamp(x); frame(); } };
  resize(); measure(); p = target;
  raf = requestAnimationFrame(loop);
}
