// normie. home story, scrubbed by scroll (replaces the pouch intro).
//  1. one stick hangs on a hairline, swings and turns so you see it is a real object
//  2. the three sticks drop in on their own strings over a giant "normie." wordmark
//  3. one chapter per flavor: the page melts into its color, the stick hangs inside a post-style card,
//     its ingredients drift past at different depths (small and far = slower and hazier)
//  4. "it's in the box.": the box sits open, the sticks drop in, a receipt slides down
// Every frame is a pure function of scroll progress (plus a tiny idle sway), so scrolling back rewinds exactly.
import * as THREE from './vendor/three.module.js';
import { FLAVORS, ORDER, makePacket, BODY_H, CAP_H } from './packets3d.js?v=20261115b';
import { RoomEnvironment } from './vendor/three-addons/environments/RoomEnvironment.js';

const section = document.querySelector('[data-story]');
if (section) boot(section);

function boot(section) {
  const $ = s => section.querySelector(s);
  const $$ = s => [...section.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = $('.story-canvas');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); }
  catch (e) { section.classList.add('story-static'); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.02;
  renderer.setClearColor(0x000000, 0);

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // timeline, in "units" of scroll (one unit is roughly one screen of scrolling)
  const T = { solo: [0, 0.75], trio: [0.55, 1.55], ch: 1.45, chLen: 1, end: 4.45, total: 5.6 };

  // must match the CSS --f-bg values so the haze blends into the page
  const BG = { base: new THREE.Color('#f3efe6'), matcha: new THREE.Color('#e9ecdd'), acai: new THREE.Color('#f2e4e3'), coffee: new THREE.Color('#efe4d6') };

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(BG.base.clone(), 8, 18);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
  camera.position.set(0, 0, 10);
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.add(new THREE.HemisphereLight('#fff7ea', '#d9c9ad', 0.8));
  const sun = new THREE.DirectionalLight('#fff4e2', 1.6); sun.position.set(-3, 6, 5); scene.add(sun);
  const rim = new THREE.DirectionalLight('#ffffff', 0.5); rim.position.set(4, 2, -3); scene.add(rim);

  /* ---------- a stick on a hairline ---------- */
  const PIVOT = 4.8;                 // above the top of the frame, so the string runs off screen
  const S = 1.1;                     // stick scale
  const TOP = (BODY_H / 2 + CAP_H) * S;
  const stringMat = new THREE.MeshBasicMaterial({ color: '#7d7264', transparent: true, opacity: 0.5 });
  function hanger(key) {
    const rig = new THREE.Group();                 // pivot point
    const stick = makePacket(key); stick.scale.setScalar(S);
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 1, 6), stringMat);
    string.geometry.translate(0, 0.5, 0);
    rig.add(stick, string); scene.add(rig);
    return { rig, stick, string };
  }
  // place a hanger so the stick's center sits at (x, y); sway rotates around the pivot
  function hang(h, x, y, sway, turn, tilt = 0) {
    const L = PIVOT - y;
    h.rig.position.set(x, PIVOT, 0);
    h.rig.rotation.z = sway;
    h.stick.position.set(0, -L, 0);
    h.stick.rotation.set(0.03, turn, tilt);
    h.string.position.set(0, -L + TOP * Math.cos(tilt) - 0.01, 0);
    h.string.scale.y = Math.max(0.01, L - TOP);
  }
  const pendulum = (u, amp, freq, damp) => amp * Math.exp(-damp * u) * Math.sin(u * freq);

  /* ---------- ingredients (modelled, so they share the sticks' light) ---------- */
  function lumpy(geo, amt, seed) {
    const p = geo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = Math.sin(v.x * 7.1 + seed) * Math.sin(v.y * 6.3 + seed * 2) * Math.sin(v.z * 5.7 + seed * 3);
      v.multiplyScalar(1 + n * amt); p.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals(); return geo;
  }
  function leafGeo() {
    const s = new THREE.Shape();
    s.moveTo(0, -0.5); s.bezierCurveTo(0.34, -0.3, 0.3, 0.32, 0, 0.55); s.bezierCurveTo(-0.3, 0.32, -0.34, -0.3, 0, -0.5);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.006, bevelSegments: 1, curveSegments: 16 });
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, p.getZ(i) + x * x * 0.9 - y * y * 0.12); }
    g.computeVertexNormals(); g.center(); return g;
  }
  function beanGeo() {
    const g = new THREE.SphereGeometry(0.2, 32, 24);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i) * 0.78, y = p.getY(i) * 1.12, z = p.getZ(i) * 0.6;
      if (z > 0) z -= 0.045 * Math.exp(-(x * x) / 0.0012);
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals(); return g;
  }
  const MAT = {
    leaf: new THREE.MeshStandardMaterial({ color: '#7d9a4c', roughness: 0.55, side: THREE.DoubleSide }),
    powder: new THREE.MeshStandardMaterial({ color: '#94ae63', roughness: 1 }),
    berry: new THREE.MeshPhysicalMaterial({ color: '#2a0d22', roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.18 }),
    berryFrost: new THREE.MeshStandardMaterial({ color: '#5a2c4a', roughness: 0.95 }),
    bean: new THREE.MeshPhysicalMaterial({ color: '#3f2414', roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.4 }),
    cocoa: new THREE.MeshStandardMaterial({ color: '#5e3d26', roughness: 1 }),
    sponge: new THREE.MeshStandardMaterial({ color: '#e2c38e', roughness: 0.95 }),
  };
  const GEO = {
    leaf: leafGeo(),
    powder: [0, 1, 2].map(s => lumpy(new THREE.IcosahedronGeometry(0.2, 3), 0.42, s + 1).scale(1.2, 0.55, 1)),
    berry: new THREE.SphereGeometry(0.17, 32, 24),
    bean: beanGeo(),
    cocoa: [0, 1].map(s => lumpy(new THREE.BoxGeometry(0.28, 0.28, 0.28, 4, 4, 4), 0.08, s + 4)),
    sponge: lumpy(new THREE.BoxGeometry(0.62, 0.2, 0.22, 6, 3, 3), 0.05, 9),
  };
  const RECIPE = {
    matcha: [['leaf', 'leaf', 7], ['powder', 'powder', 7]],
    acai: [['berry', 'berry', 11], ['berry', 'berryFrost', 3]],
    coffee: [['bean', 'bean', 8], ['cocoa', 'cocoa', 4], ['sponge', 'sponge', 2]],
  };
  function ingredients(key, ci) {
    const group = new THREE.Group(); scene.add(group);
    const bits = []; let n = 0;
    RECIPE[key].forEach(([g, m, count]) => {
      for (let i = 0; i < count; i++, n++) {
        const seed = ci * 100 + n;
        const mesh = new THREE.Mesh(Array.isArray(GEO[g]) ? GEO[g][i % GEO[g].length] : GEO[g], MAT[m]);
        const depth = rnd(seed + 1);
        const side = n % 2 ? 1 : -1;
        mesh.userData = {
          home: new THREE.Vector3(side * lerp(1.3, 4.8, rnd(seed + 2)), lerp(-3.8, 3.8, rnd(seed + 3)), lerp(-6, 2.6, depth)),
          depth, size: lerp(0.6, 1.5, rnd(seed + 4)) * lerp(0.75, 1.25, depth),
          spin: new THREE.Vector3(rnd(seed + 5) - 0.5, rnd(seed + 6) - 0.5, rnd(seed + 7) - 0.5).multiplyScalar(2.2),
          phase: rnd(seed + 8) * 6.28,
        };
        group.add(mesh); bits.push(mesh);
      }
    });
    return { group, bits };
  }

  /* ---------- the box for the ending ---------- */
  function wordmarkTexture() {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 640;
    const g = c.getContext('2d');
    g.fillStyle = '#ece3d3'; g.fillRect(0, 0, c.width, c.height);
    const img = g.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < img.data.length; i += 4) { const n = (Math.random() - 0.5) * 8; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
    g.putImageData(img, 0, 0);
    g.fillStyle = '#304236'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 190px DM, Arial, sans-serif'; try { g.letterSpacing = '-10px'; } catch (e) {}
    g.fillText('normie.', 512, 300);
    g.font = '400 34px DM, Arial, sans-serif'; try { g.letterSpacing = '6px'; } catch (e) {}
    g.fillText('MATCHA · AÇAÍ · TIRAMISU COFFEE', 512, 450);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }
  const box = new THREE.Group(); scene.add(box);
  let boxFront;
  {
    const BW = 2.3, BH = 1.45, BD = 1.25;
    const paper = new THREE.MeshStandardMaterial({ color: '#ece3d3', roughness: 0.9 });
    const inside = new THREE.MeshStandardMaterial({ color: '#d8ccb6', roughness: 0.95, side: THREE.DoubleSide });
    const front = boxFront = new THREE.MeshStandardMaterial({ map: wordmarkTexture(), roughness: 0.9 });
    const wall = (w, h, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), mat);
    const f = wall(BW, BH, [paper, paper, paper, paper, front, inside]); f.position.set(0, 0, BD / 2);
    const b = wall(BW, BH, [paper, paper, paper, paper, inside, paper]); b.position.set(0, 0, -BD / 2);
    const l = wall(BD, BH, [paper, paper, paper, paper, inside, paper]); l.rotation.y = Math.PI / 2; l.position.set(-BW / 2, 0, 0);
    const r = wall(BD, BH, [paper, paper, paper, paper, paper, inside]); r.rotation.y = Math.PI / 2; r.position.set(BW / 2, 0, 0);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(BW, 0.03, BD), inside); floor.position.y = -BH / 2;
    const lid = new THREE.Group(); lid.position.set(0, BH / 2, -BD / 2);
    const lidPanel = new THREE.Mesh(new THREE.BoxGeometry(BW, 0.03, BD), [paper, paper, inside, paper, paper, paper]); lidPanel.position.z = BD / 2;
    lid.add(lidPanel); lid.rotation.x = -1.9;
    box.add(f, b, l, r, floor, lid);
    box.userData = { BW, BH, BD };
  }
  const boxSticks = ORDER.concat(ORDER).map(k => { const s = makePacket(k); s.scale.setScalar(0.62); box.add(s); return s; });

  /* ---------- the cast ---------- */
  const solo = hanger('matcha');
  const trio = ORDER.map(k => hanger(k));
  const chapters = ORDER.map((key, ci) => ({ key, h: hanger(key), ...ingredients(key, ci) }));

  /* ---------- page layers ---------- */
  const words = $$('[data-word]');
  const copies = $$('[data-copy]');
  const cards = $$('.story-post');
  const dots = $$('.story-dots i');
  const receipt = $('.story-receipt');
  const hint = $('.story-hint');

  let W = 0, H = 0, aspect = 1;
  function resize() {
    const r = canvas.getBoundingClientRect(); W = r.width; H = r.height; aspect = W / Math.max(1, H);
    renderer.setSize(W, H, false); camera.aspect = aspect;
    camera.position.z = aspect < 0.8 ? 10 * Math.pow(0.8 / aspect, 0.6) : 10;   // pull back on phones so sticks keep their size
    camera.updateProjectionMatrix();
    scene.fog.near = camera.position.z - 2; scene.fog.far = camera.position.z + 8;   // haze only the far ingredients
    draw();
  }
  function progress() {
    const r = section.getBoundingClientRect();
    const total = r.height - innerHeight;
    return total > 0 ? clamp(-r.top / total) : 0;
  }
  const v3 = new THREE.Vector3();
  const toScreen = (x, y, z = 0) => { v3.set(x, y, z).project(camera); return [(v3.x + 1) / 2 * W, (1 - v3.y) / 2 * H]; };
  const show = (el, o, dy = 14) => { el.style.opacity = o.toFixed(3); el.style.visibility = o > 0.01 ? 'visible' : 'hidden'; if (dy) el.style.transform = `translateY(${((1 - o) * dy).toFixed(1)}px)`; };
  const win = (x, a, b, f = 0.12) => clamp(Math.min(seg(x, a - f, a + f), 1 - seg(x, b - f, b + f)));

  let flavorNow = null, centered = false;
  const bootTime = performance.now();
  function setFlavor(k) {
    if (k === flavorNow) return;
    flavorNow = k;
    if (k) section.dataset.flavor = k; else delete section.dataset.flavor;
    const root = document.documentElement;
    if (centered) { if (k) root.dataset.flavor = k; else delete root.dataset.flavor; }
    dots.forEach((d, i) => d.classList.toggle('on', ORDER[i] === k));
  }

  let lastDraw = 0;
  function draw(time = performance.now()) {
    if (!W) return;
    lastDraw = performance.now();
    const t = reduced ? 0 : time / 1000;
    const x = progress() * T.total;
    const narrow = aspect < 0.8;
    const halfH = Math.tan(THREE.MathUtils.degToRad(16)) * camera.position.z, halfW = halfH * aspect;
    const stageX = narrow ? 0 : Math.min(1.4, halfW * 0.28);

    // ----- 1. the solo stick: swings in, turns, lifts out -----
    {
      // on load the stick drops in by itself and keeps swaying, so the first screen is never empty;
      // scrolling then spins it and lifts it out
      const u = seg(x, T.solo[0], T.solo[1]);
      const sinceLoad = reduced ? 9 : (time - bootTime) / 1000;
      const drop = smooth(clamp(sinceLoad / 1.6));
      const leave = smooth(seg(x, 0.55, 0.78));
      const vis = x < 0.8;
      solo.rig.visible = vis;
      if (vis) {
        const y = 0.15 + (1 - drop) * 4.5 + leave * 6;
        const swing = pendulum(sinceLoad + 0.15, 0.2, 4.2, 0.9) + Math.sin(t * 1.1) * 0.035 * drop;
        hang(solo, narrow ? 0 : 0.2, y,
          swing + pendulum(u * 2.4, 0.18, 9, 2.2),
          u * Math.PI * 2.3 + Math.sin(t * 0.45) * 0.35);
      }
    }
    // ----- 2. three sticks on strings over the wordmark -----
    {
      const vis = x > 0.45 && x < 1.75;
      const spread = narrow ? Math.min(1.05, halfW * 0.5) : Math.min(1.7, halfW * 0.3);
      const tilts = [-0.22, 0.05, 0.26], heights = [0.35, 0.05, 0.25], delays = [0, 0.1, 0.05];
      trio.forEach((h, i) => {
        h.rig.visible = vis;
        if (!vis) return;
        const enter = smooth(seg(x, 0.6 + delays[i], 0.95 + delays[i]));
        const leave = smooth(seg(x, 1.3 + delays[i] * 0.5, 1.6 + delays[i] * 0.5));
        const settle = clamp(x - 0.6 - delays[i]);
        hang(h, (i - 1) * spread, heights[i] + (1 - enter) * 5 + leave * 6,
          pendulum(settle * 2, 0.07, 11, 3) + Math.sin(t * 0.7 + i) * 0.008,
          lerp(-0.3, 0.3, smooth(seg(x, 0.6, 1.5))) + i * 0.15, tilts[i] * (1 - leave * 0.5));
      });
    }
    // ----- 3. the flavor chapters -----
    let flavor = null;
    chapters.forEach((c, i) => {
      const u = x - (T.ch + i * T.chLen);                 // 0..1 while this chapter is on screen
      const vis = clamp(Math.min(seg(u, -0.18, 0.1), 1 - seg(u, 0.9, 1.18)));
      c.h.rig.visible = c.group.visible = vis > 0.001;
      if (u >= 0 && u < 1) flavor = c.key;
      if (!c.group.visible) return;
      const enter = smooth(seg(u, -0.18, 0.16)), leave = smooth(seg(u, 0.86, 1.12));
      const settle = clamp(u + 0.18);
      hang(c.h, stageX, -0.05 + (1 - enter) * 5.2 + leave * 6,
        pendulum(settle, 0.14, 13, 4.2) + Math.sin(t * 0.7 + i) * 0.01,
        lerp(-0.5, 0.5, smooth(seg(u, 0, 1))) + Math.sin(t * 0.5 + i) * 0.03);
      c.bits.forEach(m => {
        const d = m.userData;
        const travel = (u - 0.5) * 9 * lerp(0.2, 0.6, d.depth);
        m.position.set(d.home.x * (narrow ? 0.6 : 1) + stageX * 0.5, d.home.y + travel + Math.sin(t * 0.6 + d.phase) * 0.05, d.home.z);
        m.rotation.set(d.spin.x * u * 2 + d.phase, d.spin.y * u * 2 + t * 0.05, d.spin.z * u * 2);
        m.scale.setScalar(d.size * Math.max(0.0001, vis));
      });
      // the post card frames the stick: it follows the stick's projected position
      const card = cards[i];
      if (card) {
        const [sx, sy] = toScreen(stageX, -0.05);
        const o = clamp(Math.min(seg(u, 0.02, 0.2), 1 - seg(u, 0.78, 0.95)));
        card.style.left = `${sx.toFixed(1)}px`; card.style.top = `${sy.toFixed(1)}px`;
        card.style.opacity = o.toFixed(3); card.style.visibility = o > 0.01 ? 'visible' : 'hidden';
        card.style.transform = `translate(-50%, -50%) translateY(${((1 - o) * 24).toFixed(1)}px) rotate(${(-1.5 + o * 1.5).toFixed(2)}deg)`;
      }
    });
    if (!chapters.some(c => c.h.rig.visible)) cards.forEach(c => { c.style.visibility = 'hidden'; c.style.opacity = 0; });
    setFlavor(flavor);

    // ----- 4. it's in the box -----
    {
      const u = x - T.end;                                  // 0..~1.15
      const vis = u > -0.25;
      box.visible = vis;
      if (vis) {
        const enter = smooth(seg(u, -0.25, 0.15));
        const bx = narrow ? 0 : Math.min(1.5, halfW * 0.3);
        box.position.set(bx, (narrow ? 0.2 : -1.15) - (1 - enter) * 4, -0.5);
        box.rotation.set(0.32, -0.42 + Math.sin(t * 0.3) * 0.02, 0);
        box.scale.setScalar(narrow ? 1.1 : 1);
        const { BH } = box.userData;
        boxSticks.forEach((s, i) => {
          const d = smooth(seg(u, 0.18 + i * 0.07, 0.42 + i * 0.07));
          const col = i % 3, row = Math.floor(i / 3);
          s.position.set((col - 1) * 0.5 + (row ? 0.22 : -0.1), lerp(4.5, -BH / 2 + 0.62 + row * 0.05, d), (row ? -0.18 : 0.2));
          s.rotation.set(0, (col - 1) * 0.15 + (row ? 0.4 : -0.2), (1 - d) * (i % 2 ? 0.5 : -0.5) + (col - 1) * 0.06);
          s.visible = d > 0.001;
        });
      }
      if (receipt) {
        const o = smooth(seg(u, 0.35, 0.7));
        receipt.style.opacity = Math.min(1, o * 1.6).toFixed(3);
        receipt.style.visibility = o > 0.005 ? 'visible' : 'hidden';
        receipt.style.transform = `translateY(${lerp(-110, 0, o).toFixed(1)}%) rotate(${lerp(-4, -2, o).toFixed(2)}deg)`;
      }
    }

    // ----- page copy -----
    words.forEach(w => {
      const k = w.dataset.word;
      let o = 0, s = 1, dy = 0;
      if (k === 'normie') { o = win(x, 0.8, 1.45, 0.15); s = lerp(0.96, 1.08, smooth(seg(x, 0.8, 1.6))); dy = (1.1 - x) * 6; }
      else {
        const i = ORDER.indexOf(k), u = x - (T.ch + i * T.chLen);
        o = clamp(Math.min(seg(u, -0.05, 0.15), 1 - seg(u, 0.85, 1.05))); s = lerp(1.06, 1, smooth(clamp(u * 2))); dy = (0.5 - u) * 8;
      }
      w.style.opacity = o.toFixed(3);
      w.style.transform = `translate(-50%, calc(-50% + ${dy.toFixed(2)}vh)) scale(${s.toFixed(4)})`;
    });
    copies.forEach(el => {
      const k = el.dataset.copy;
      let o = 0;
      if (k === 'intro') o = win(x, 0.85, 1.4, 0.12);
      else if (k === 'end') o = smooth(seg(x - T.end, 0.25, 0.55));
      else { const u = x - (T.ch + ORDER.indexOf(k) * T.chLen); o = clamp(Math.min(seg(u, 0.05, 0.22), 1 - seg(u, 0.8, 0.95))); }
      show(el, o);
    });
    if (hint) hint.style.opacity = (1 - seg(x, 0.05, 0.3)).toFixed(3);
    section.style.setProperty('--story-dots', String(win(x, T.ch, T.end, 0.1)));

    renderer.render(scene, camera);
  }

  new IntersectionObserver(([e]) => {
    centered = e.isIntersecting;
    const root = document.documentElement;
    if (centered && flavorNow) root.dataset.flavor = flavorNow;
    else if (!centered && flavorNow && root.dataset.flavor === flavorNow) delete root.dataset.flavor;
  }, { rootMargin: '-50% 0px -50% 0px' }).observe(section);

  let raf = 0, visible = false;
  const loop = time => { draw(time); raf = visible ? requestAnimationFrame(loop) : 0; };
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    document.body.classList.toggle('intro-active', visible && progress() < 0.98);
    if (visible && !raf) raf = requestAnimationFrame(loop);
  }).observe(section);
  addEventListener('resize', resize);
  addEventListener('scroll', () => { if (performance.now() - lastDraw > 60) draw(); }, { passive: true });   // keep frames in sync even if animation frames are throttled
  (document.fonts ? document.fonts.load('700 190px DM').then(() => document.fonts.ready) : Promise.resolve()).then(() => { boxFront.map.dispose(); boxFront.map = wordmarkTexture(); boxFront.needsUpdate = true; resize(); section.classList.add('story-ready'); });
  resize();
}
