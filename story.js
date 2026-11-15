// normie. home story, scrubbed by scroll (replaces the pouch intro).
//  1. one stick hangs on a hairline, swings and turns so you see it is a real object
//  2. the three sticks drop in on their own strings over a giant "normie." wordmark
//  3. one chapter per flavor: the page melts into its color, the stick hangs inside a post-style card,
//     its ingredients drift past at different depths (small and far = slower and hazier)
//  4. "it's in the pouch.": a clear zip pouch opens, twelve sticks drop in, it zips shut
// Every frame is a pure function of scroll progress (plus a tiny idle sway), so scrolling back rewinds exactly.
import * as THREE from './vendor/three.module.js';
import { FLAVORS, ORDER, makePacket, BODY_H, CAP_H, W as STICK_W } from './packets3d.js?v=20261115c';
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
  const T = { solo: [0, 0.75], trio: [0.55, 1.55], ch: 1.45, chLen: 1.25, end: 5.2, total: 6.35 };   // each chapter: 1 unit on screen + a 0.25 breath

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
  const hiddenString = new THREE.MeshBasicMaterial({ visible: false });
  function hanger(key) {
    const rig = new THREE.Group();                 // pivot point
    const stick = makePacket(key); stick.scale.setScalar(S);
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 1, 6), stringMat);
    string.geometry.translate(0, 0.5, 0);
    rig.add(stick, string); scene.add(rig);
    return { rig, stick, string };
  }
  // place a hanger so the stick's center sits at (x, y); sway rotates around the pivot
  function hang(h, x, y, sway, turn, tilt = 0, sc = 1, pivot = PIVOT) {
    const L = pivot - y;
    h.stick.scale.setScalar(S * sc);
    h.rig.position.set(x, pivot, 0);
    h.rig.rotation.z = sway;
    h.stick.position.set(0, -L, 0);
    h.stick.rotation.set(0.03, turn, tilt);
    h.string.position.set(0, -L + TOP * sc * Math.cos(tilt) - 0.01, 0);
    h.string.scale.y = Math.max(0.01, L - TOP * sc);
  }
  const pendulum = (u, amp, freq, damp) => amp * Math.exp(-damp * u) * Math.sin(u * freq);
  // three hanging sticks that swing and collide (equal mass, slightly lossy hits). Stepped forward
  // from SIM_X0 by scroll, so any scroll position always gives the same frame.
  const TAU = Math.PI * 2, HAND = 0.58, SIM_X0 = 1.08, SIM_K = 22, SIM_DT = 1 / 240, MASS = [1, 1.6, 1.6];
  const sim = { key: '', x: 0, th: [0, 0, 0], w: [0, 0, 0] };
  function trioSim(x, px, L, dmin, pull) {
    if (x <= SIM_X0) return [0, 0, 0];
    const key = px.map(v => v.toFixed(3)).join() + L.map(v => v.toFixed(3)).join() + pull.toFixed(4);
    if (sim.key !== key || x < sim.x) { sim.key = key; sim.x = SIM_X0; sim.th = [pull, 0, 0]; sim.w = [0, 0, 0]; }
    const { th, w } = sim, e = 0.82, g = 9.8, damp = 0.08;
    const steps = Math.min(12000, Math.floor((x - sim.x) * SIM_K / SIM_DT));
    for (let n = 0; n < steps; n++) {
      for (let i = 0; i < 3; i++) { w[i] += (-(g / L[i]) * Math.sin(th[i]) - damp * w[i]) * SIM_DT; th[i] += w[i] * SIM_DT; }
      for (let i = 0; i < 2; i++) {
        const j = i + 1;
        const ci = px[i] + L[i] * Math.sin(th[i]), cj = px[j] + L[j] * Math.sin(th[j]);
        const gap = cj - ci;
        if (gap >= dmin) continue;
        const ki = L[i] * Math.cos(th[i]), kj = L[j] * Math.cos(th[j]);
        const vi = ki * w[i], vj = kj * w[j];
        if (vi > vj) {                                    // closing: bounce
          const mi = MASS[i], mj = MASS[j], p = mi * vi + mj * vj;
          w[i] = (p - mj * e * (vi - vj)) / (mi + mj) / ki;   // the lighter striker recoils
          w[j] = (p + mi * e * (vi - vj)) / (mi + mj) / kj;
        }
        const o = (dmin - gap) / 2;                       // never let them overlap
        th[i] -= o / ki; th[j] += o / kj;
      }
    }
    sim.x += steps * SIM_DT / SIM_K;
    return th.slice();
  }

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
    berryFrost: new THREE.MeshPhysicalMaterial({ color: '#4a1838', roughness: 0.6, clearcoat: 0.6 }),
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
    matcha: [['leaf', 'leaf', 5], ['powder', 'powder', 3]],
    acai: [['berry', 'berry', 7], ['berry', 'berryFrost', 2]],
    coffee: [['bean', 'bean', 6], ['cocoa', 'cocoa', 2], ['sponge', 'sponge', 1]],
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
          home: (() => {
            // the left half belongs to the heading and copy: ingredients there stay in the top band, far back
            if (side < 0) return new THREE.Vector3(-lerp(3.4, 6.5, rnd(seed + 2)), lerp(2.7, 4.2, rnd(seed + 3)), lerp(-7, -3, depth));
            return new THREE.Vector3(lerp(2.6, 5.4, rnd(seed + 2)), lerp(-3.6, 3.6, rnd(seed + 3)), lerp(-6, 1.8, depth));
          })(),
          depth, size: lerp(0.6, 1.5, rnd(seed + 4)) * lerp(0.75, 1.25, depth),
          spin: new THREE.Vector3(rnd(seed + 5) - 0.5, rnd(seed + 6) - 0.5, rnd(seed + 7) - 0.5).multiplyScalar(2.2),
          phase: rnd(seed + 8) * 6.28,
        };
        group.add(mesh); bits.push(mesh);
      }
    });
    // two big pieces right by the camera, half off the edge of the screen (sharp, faster: the near layer)
    const [g0, m0] = RECIPE[key][0];
    [[2.0, 0], [-1.6, 1]].forEach(([y, j]) => {
      const mesh = new THREE.Mesh(Array.isArray(GEO[g0]) ? GEO[g0][j] : GEO[g0], MAT[m0]);
      mesh.userData = { home: new THREE.Vector3(0, y, 4.2), depth: 1, size: 2.4 - j * 0.4, big: true,
        spin: new THREE.Vector3(0.3, 0.5, 0.2), phase: j * 2 };
      group.add(mesh); bits.push(mesh);
    });
    return { group, bits };
  }

  /* ---------- the pouches for the ending: modelled clear zip pouches that open and fill ---------- */
  const PW = 2.25, PHT = 3.0, PD = 0.78;                  // width, height, bottom depth
  const ZIP = PHT / 2 - 0.42;                              // zipper line, measured from the center
  function filmGeo() {
    const g = new THREE.BoxGeometry(PW, ZIP + PHT / 2, PD, 16, 24, 8);
    g.translate(0, (ZIP - PHT / 2) / 2, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const v = (y + PHT / 2) / (ZIP + PHT / 2);           // 0 at the base, 1 at the zipper
      const depth = lerp(1, 0.08, Math.pow(v, 0.8));        // gusseted base, flat top
      const pinch = 1 - 0.05 * Math.pow(1 - v, 3);          // a little narrower at the base
      const bulge = 1 + 0.06 * Math.sin(Math.PI * clamp((x / PW) + 0.5)) * (1 - v);
      p.setXYZ(i, x * pinch, y, z * depth * bulge);
    }
    g.computeVertexNormals(); return g;
  }
  const FILM_GEO = filmGeo();
  const film = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05,
    transparent: true, opacity: 0.34, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.6 });
  const seamMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.2, clearcoat: 1, transparent: true, opacity: 0.7, depthWrite: false });
  // light catching the film: soft vertical streaks and a bright outline
  const streakTex = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 8; const g = c.getContext('2d'); const lg = g.createLinearGradient(0, 0, 256, 0); [[0,0],[.08,.55],[.14,.1],[.2,0],[.62,0],[.7,.3],[.76,0],[.9,0],[.95,.4],[1,.1]].forEach(([o,a]) => lg.addColorStop(o, `rgba(255,255,255,${a})`)); g.fillStyle = lg; g.fillRect(0, 0, 256, 8); return new THREE.CanvasTexture(c); })();
  const streakMat = new THREE.MeshBasicMaterial({ map: streakTex, transparent: true, depthWrite: false, toneMapped: false, opacity: 0.85 });
  const edgeMat = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 });
  function printTexture(draw, w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }
  const printed = [];                                      // redrawn once the brand font has loaded
  function makePouch(key) {
    const f = FLAVORS[key];
    const g = new THREE.Group();
    const body = new THREE.Mesh(FILM_GEO, film); body.renderOrder = 5; g.add(body);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(FILM_GEO, 25), edgeMat); edges.renderOrder = 6; g.add(edges);
    const streak = new THREE.Mesh(new THREE.PlaneGeometry(PW * 0.98, ZIP + PHT / 2 - 0.1), streakMat);
    streak.position.set(0, (ZIP - PHT / 2) / 2, PD * 0.42); streak.rotation.x = -0.12; streak.renderOrder = 8; g.add(streak);
    // side seals and the zipper band
    [-1, 1].forEach(sx => { const seal = new THREE.Mesh(new THREE.BoxGeometry(0.06, PHT, 0.01), seamMat); seal.position.set(sx * PW / 2, 0, 0); seal.renderOrder = 6; g.add(seal); });
    const zip = new THREE.Mesh(new THREE.BoxGeometry(PW, 0.07, 0.07), seamMat); zip.position.y = ZIP; zip.renderOrder = 6; g.add(zip);
    // the two lips above the zipper, hinged at the zipper so the pouch can open
    const lips = [1, -1].map(side => {
      const hinge = new THREE.Group(); hinge.position.set(0, ZIP, side * 0.03);
      const lip = new THREE.Mesh(new THREE.PlaneGeometry(PW, PHT / 2 - ZIP), film);
      lip.position.y = (PHT / 2 - ZIP) / 2; lip.renderOrder = 6;
      hinge.add(lip); hinge.userData.side = side; g.add(hinge); return hinge;
    });
    // print on the film: wordmark, and the cream label card
    const draw = (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = f.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '700 230px DM, Arial, sans-serif'; try { ctx.letterSpacing = '-12px'; } catch (e) {}
      ctx.fillText('normie.', w / 2, h / 2);
    };
    const wordTex = printTexture(draw, 1024, 320); printed.push([wordTex, draw]);
    const word = new THREE.Mesh(new THREE.PlaneGeometry(PW * 0.78, PW * 0.78 * 320 / 1024), new THREE.MeshBasicMaterial({ map: wordTex, transparent: true, depthWrite: false, toneMapped: false }));
    word.position.set(0, PHT / 2 - 0.95, 0.09); word.renderOrder = 7; g.add(word);
    const drawLabel = (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#f6efe2'; ctx.beginPath(); ctx.roundRect(4, 4, w - 8, h - 8, 34); ctx.fill();
      ctx.fillStyle = f.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.font = '700 96px DM, Arial, sans-serif'; try { ctx.letterSpacing = '-3px'; } catch (e) {}
      ctx.fillText(f.name, 44, 130);
      ctx.font = '400 46px DM, Arial, sans-serif'; try { ctx.letterSpacing = '0px'; } catch (e) {}
      ctx.globalAlpha = 0.8; ctx.fillText('12 stick packs · single serving', 46, 214);
    };
    const labelTex = printTexture(drawLabel, 900, 270); printed.push([labelTex, drawLabel]);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5 * 270 / 900), new THREE.MeshStandardMaterial({ map: labelTex, transparent: true, roughness: 0.85, depthWrite: false }));
    label.position.set(-0.22, -PHT / 2 + 0.55, PD * 0.56); label.renderOrder = 9; g.add(label);
    // twelve sticks: three rows of four, like the real pouch
    const sticks = [];
    for (let i = 0; i < 12; i++) {
      const st = makePacket(key); st.scale.setScalar(0.44);
      const row = Math.floor(i / 4), col = i % 4;
      // rows sit fully inside the film: bottoms clear of the base seal, tops below the zipper, rows close together
      st.userData.slot = new THREE.Vector3((col - 1.5) * 0.44 + (row === 1 ? 0.1 : 0), -PHT / 2 + 0.3 + BODY_H / 2 * 0.44 + row * 0.03, (1 - row) * 0.09);
      st.position.copy(st.userData.slot); g.add(st); sticks.push(st);
    }
    // fill order: back row first so the front row lands last, in plain view
    sticks.sort((a, b) => a.userData.slot.z - b.userData.slot.z || a.userData.slot.x - b.userData.slot.x);
    g.userData = { lips, sticks };
    scene.add(g); return g;
  }
  const pouchKeys = ['matcha', 'acai', 'coffee'];
  const pouches = pouchKeys.map(makePouch);
  const shadowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(90,70,45,.32)'); r.addColorStop(1, 'rgba(90,70,45,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const shadows = pouches.map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, fog: false })); m.rotation.x = -Math.PI / 2; scene.add(m); return m; });

  /* ---------- the cast ---------- */
  const solo = hanger('matcha');
  const trio = ORDER.map(k => hanger(k));
  const chapters = ORDER.map((key, ci) => ({ key, h: hanger(key), ...ingredients(key, ci) }));

  /* ---------- page layers ---------- */
  const words = $$('[data-word]');
  const copies = $$('[data-copy]');
  const cards = $$('.story-post');
  const dots = $$('.story-dots i');
  const hint = $('.story-hint');

  let W = 0, H = 0, aspect = 1;
  function resize() {
    const r = canvas.getBoundingClientRect(); W = r.width; H = r.height; aspect = W / Math.max(1, H);
    renderer.setSize(W, H, false); camera.aspect = aspect;
    camera.position.z = aspect < 0.8 ? 10 * Math.pow(0.8 / aspect, 0.6) : 10;   // pull back on phones so sticks keep their size
    camera.updateProjectionMatrix();
    scene.fog.near = camera.position.z + 1; scene.fog.far = camera.position.z + 16;   // haze only the far ingredients
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
    const chapterX = i => (i === 1 ? -1 : 1) * stageX;

    let soloPose = null;
    // ----- 1. open on the wordmark with a hairline running off the bottom of the screen;
    //         scrolling reels the stick up into view, it swings, turns, and lifts out -----
    {
      const u = seg(x, T.solo[0], T.solo[1]);
      const sinceLoad = reduced ? 9 : (time - bootTime) / 1000;
      const rise = smooth(seg(x, 0.04, 0.34));               // 0: stick waits below the fold
      const vis = x < 0.95;
      solo.rig.visible = x < HAND;                            // past HAND the trio's matcha carries on as this same stick
      if (vis) {
        // anchor: just under the "scroll" label, measured from the page so it lines up at any size
        let anchor = -halfH * 0.45;
        if (hint) { const r = hint.getBoundingClientRect(), cr = canvas.getBoundingClientRect(); anchor = (1 - 2 * ((r.bottom + 8 - cr.top) / H)) * halfH; }
        const below = -halfH - TOP - 0.4;                      // the stick waits below the fold
        const lift = (0.15 - below) * rise;                    // scrolling pulls the whole string up
        const swing = rise * (pendulum(u * 2.4 + 0.1, 0.16, 9, 2.2) + Math.sin(t * 1.1) * 0.03) + (1 - rise) * (Math.sin(sinceLoad * 1.9) * 0.012 + Math.sin(sinceLoad * 0.7) * 0.006);
        soloPose = [0, below + lift, swing, rise * (u * Math.PI * 2.1) + Math.sin(t * 0.45) * 0.3 * rise, 0, 1, anchor + lift];
        if (solo.rig.visible) hang(solo, ...soloPose);
      }
    }
    // ----- 2. three sticks on strings over the wordmark -----
    {
      const vis = x > 0.45 && x < 1.75;
      const spread = narrow ? Math.min(1.05, halfW * 0.56) : Math.min(2.2, halfW * 0.3);
      const tilts = [-0.1, 0.02, 0.11], heights = [0.05, -0.15, 0.0], delays = [0, 0.1, 0.05];
      const carry = smooth(seg(x, 1.3, 1.5));               // matcha travels into its chapter instead of cutting
      const sc = narrow ? 1.0 : 1.05, off = narrow ? 0 : 0.35, drop = narrow ? 0.1 : 0.35;
      const px = [0, 1, 2].map(i => (i - 1) * spread + off), py = heights.map(h => h - drop);
      const L = py.map(y => PIVOT - y), dmin = STICK_W * S * sc * 1.04;
      // matcha is drawn back, let go, and strikes açaí, which knocks into tiramisu: a real pendulum sim
      const pull = -Math.min(0.42, Math.asin(Math.min(0.9, (px[1] - px[0] - dmin + 0.55) / L[0])));
      const th = trioSim(x, px, L, dmin, pull);
      const windup = pull * smooth(seg(x, 0.95, SIM_X0));
      trio.forEach((h, i) => {
        h.rig.visible = vis && !(i === 0 && (x >= 1.5 || x < HAND));
        if (!h.rig.visible) return;
        const idle = Math.sin(t * 0.7 + i) * 0.008;
        if (i === 0) {
          const swing = x < SIM_X0 ? windup : th[0];
          const tx = chapterX(0), ty = -0.05;
          const turn0 = lerp(-0.3, 0.3, smooth(seg(x, 0.6, 1.5)));
          // the landing stick itself walks over into the lineup: one matcha, never two
          const join = smooth(seg(x, HAND, 0.95));
          if (join < 1 && soloPose) {
            const [sx, sy, sw, st, , ssc, sp] = soloPose;
            const stw = turn0 + (((st - turn0) % TAU) + TAU + Math.PI) % TAU - Math.PI;   // unwind by the short way round
            hang(h, lerp(sx, px[0], join), lerp(sy, py[0], join), lerp(sw, swing + idle, join), lerp(stw, turn0, join),
              tilts[0] * join, lerp(ssc, sc, join), lerp(sp, PIVOT, join));
            h.string.material = stringMat;
            return;
          }
          hang(h, lerp(px[0], tx, carry), lerp(py[0], ty, carry), lerp(swing + idle, 0, carry),
            lerp(turn0, -0.444, carry), tilts[0] * (1 - carry), lerp(sc, 0.8, carry));
          h.string.material = carry > 0.55 ? hiddenString : stringMat;
          return;
        }
        h.string.material = stringMat;
        const enter = smooth(seg(x, 0.6 + delays[i], 0.95 + delays[i]));
        const leave = smooth(seg(x, 1.2 + delays[i] * 0.5, 1.45 + delays[i] * 0.5));
        const settle = clamp(x - 0.6 - delays[i]);
        hang(h, px[i], py[i] + (1 - enter) * 5 + leave * 6,
          pendulum(settle * 2, 0.07, 11, 3) + idle + th[i],
          lerp(-0.3, 0.3, smooth(seg(x, 0.6, 1.5))) + i * 0.15, tilts[i] * (1 - leave * 0.5), sc);
      });
    }
    // ----- 3. the flavor chapters -----
    let flavor = null;
    chapters.forEach((c, i) => {
      const u = x - (T.ch + i * T.chLen);                 // 0..1 while this chapter is on screen
      const vis = clamp(Math.min(i === 0 ? seg(u, -0.18, 0.1) : seg(u, 0, 0.14), 1 - seg(u, 0.84, 1.0)));   // gone by u = 1: the breath before the next flavor
      c.h.rig.visible = c.group.visible = vis > 0.001;
      if (u >= 0 && u < 1) flavor = c.key;
      if (!c.group.visible) { const cd = cards[i]; if (cd) { cd.style.visibility = 'hidden'; cd.style.opacity = 0; cd.classList.remove('is-in'); } return; }
      // no string here: the stick simply appears in its card, turns slowly, and goes
      const appear = i === 0 ? (x >= 1.5 ? 1 : 0) : smooth(seg(u, 0, 0.16)), go = smooth(seg(u, 0.8, 0.98));
      c.h.string.visible = false;
      hang(c.h, chapterX(i), -0.05 - (1 - appear) * 0.25 + go * 0.25, 0,
        lerp(-0.45, 0.45, smooth(seg(u, 0, 1))) + Math.sin(t * 0.5 + i) * 0.03);
      const csc = 0.8 * lerp(0.94, 1, appear);
      c.h.stick.scale.setScalar(appear * (1 - go) > 0.001 ? S * csc : 0.0001);
      c.bits.forEach(m => {
        const d = m.userData;
        const travel = (u - 0.5) * 9 * lerp(0.2, 0.6, d.depth);
        const side = i === 1 && !narrow ? -1 : 1;
        if (d.big) {
          const zD = camera.position.z - d.home.z, edge = Math.tan(THREE.MathUtils.degToRad(16)) * zD * aspect;
          m.position.set(side * (edge + 0.15), d.home.y + travel * 1.6, d.home.z);
        } else m.position.set(side * (d.home.x * (narrow ? 0.6 : 1) + (d.home.x > 0 ? stageX * 0.5 : 0)), d.home.y + travel + Math.sin(t * 0.6 + d.phase) * 0.05, d.home.z);
        m.rotation.set(d.spin.x * u * 2 + d.phase, d.spin.y * u * 2 + t * 0.05, d.spin.z * u * 2);
        m.scale.setScalar(d.size * Math.max(0.0001, vis));
      });
      // the post card frames the stick: it follows the stick's projected position
      const card = cards[i];
      if (card) {
        // the stick's real extent: cap crimp on top, bottom crimp below (the model is not centered)
        const sc8 = S * 0.8, cy = -0.05;
        const [sx] = toScreen(chapterX(i), cy);
        const [, st] = toScreen(stageX, cy + (BODY_H / 2 + CAP_H) * sc8), [, sb] = toScreen(stageX, cy - (BODY_H / 2 + 0.12) * sc8);
        const pad = (sb - st) * 0.1;
        const mediaH = (sb - st) + pad * 2, mediaW = mediaH * 0.74;
        card.style.setProperty('--media-w', `${mediaW.toFixed(0)}px`);
        card.style.setProperty('--media-h', `${mediaH.toFixed(0)}px`);
        const sy = st - pad - 56;                           // card top: media top minus the header row
        const o = clamp(Math.min(seg(u, 0.04, 0.2), 1 - seg(u, 0.76, 0.92)));
        card.style.left = `${sx.toFixed(1)}px`; card.style.top = `${sy.toFixed(1)}px`;
        card.style.opacity = o.toFixed(3); card.style.visibility = o > 0.01 ? 'visible' : 'hidden';
        if (o > 0.6) card.classList.add('is-in'); else if (o < 0.05) card.classList.remove('is-in');   // replays the icon pop each visit
        card.style.transform = `translate(-50%, ${((1 - o) * 24).toFixed(1)}px)`;
      }
    });
    if (!chapters.some(c => c.h.rig.visible)) cards.forEach(c => { c.style.visibility = 'hidden'; c.style.opacity = 0; });
    setFlavor(flavor);

    // ----- 4. it's in the pouch: the front pouch unzips, twelve sticks drop in, it zips shut;
    //         the other two flavors stand behind it, already full -----
    {
      const u = x - T.end;
      const vis = u > -0.35;
      const cx = narrow ? 0 : Math.min(2.1, halfW * 0.4);
      const sc0 = narrow ? 0.72 : 0.92;
      const lay = [[0, narrow ? 0.55 : -0.45, 0.6, 0, 1], [-1.85, narrow ? 1.05 : 0.15, -3.2, 0.28, 0.82], [1.85, narrow ? 1.05 : 0.15, -3.2, -0.28, 0.82]];
      pouches.forEach((g, i) => {
        g.visible = shadows[i].visible = vis;
        if (!vis) return;
        const [lx, ly, lz, ry, sc] = lay[i];
        const d = smooth(seg(u, -0.35 + i * 0.08, 0.15 + i * 0.08));
        const S2 = sc * sc0;
        g.scale.setScalar(S2);
        g.position.set(cx + lx * (narrow ? 0.55 : 1), ly - (1 - d) * 6 + Math.sin(t * 0.6 + i * 1.7) * 0.02, lz);
        g.rotation.set(0.04, ry + Math.sin(t * 0.3 + i) * 0.02, 0);
        const sh = shadows[i]; sh.position.set(g.position.x, g.position.y - PHT / 2 * S2 + 0.01, lz + 0.1); sh.scale.set(PW * 1.5 * S2, PD * 1.4 * S2, 1); sh.material.opacity = d;
        const { lips, sticks } = g.userData;
        if (i === 0) {
          const open = smooth(seg(u, 0.12, 0.28)) * (1 - smooth(seg(u, 0.88, 1.02)));
          lips.forEach(h => { h.rotation.x = h.userData.side * lerp(-0.06, 0.8, open); });
          sticks.forEach((st, j) => {
            const k = seg(u, 0.24 + j * 0.045, 0.4 + j * 0.045);
            st.visible = k > 0;
            const e = 1 - Math.pow(1 - k, 2);                    // fall, then ease into the slot
            const sl = st.userData.slot;
            st.position.set(sl.x + (1 - e) * (j % 2 ? 0.25 : -0.25), lerp(sl.y + 4.6, sl.y, e), sl.z);
            st.rotation.set(0, 0, (1 - e) * (j % 2 ? 0.5 : -0.5));
          });
        } else {
          lips.forEach(h => { h.rotation.x = h.userData.side * -0.06; });
          sticks.forEach(st => { st.visible = true; st.position.copy(st.userData.slot); st.rotation.set(0, 0, 0); });
        }
      });
    }

    // ----- page copy -----
    words.forEach(w => {
      const k = w.dataset.word;
      let o = 0, s = 1, dy = 0;
      if (k === 'normie') { o = 1 - smooth(seg(x, 0.3, 0.55)); s = lerp(1, 1.04, smooth(seg(x, 0.1, 0.55))); dy = 0; }   // the wordmark belongs to the landing screen only
      else {
        const i = ORDER.indexOf(k), u = x - (T.ch + i * T.chLen);
        o = clamp(Math.min(seg(u, 0, 0.16), 1 - seg(u, 0.82, 0.98))); s = lerp(1.06, 1, smooth(clamp(u * 2))); dy = (0.5 - u) * 8;
      }
      w.style.opacity = o.toFixed(3);
      // the wordmark is centered; flavor names sit left, clear of the card, as the chapter's heading
      w.style.transform = k === 'normie'
        ? `translate(-50%, calc(-50% + ${dy.toFixed(2)}vh)) scale(${s.toFixed(4)})`
        : `translate(0, calc(-50% + ${(dy * 0.4).toFixed(2)}vh)) scale(${s.toFixed(4)})`;   // açaí's heading is right-aligned in CSS
    });
    copies.forEach(el => {
      const k = el.dataset.copy;
      let o = 0;
      if (k === 'intro') o = win(x, 0.85, 1.4, 0.12);
      else if (k === 'end') o = smooth(seg(x - T.end, 0.25, 0.55));
      else { const u = x - (T.ch + ORDER.indexOf(k) * T.chLen); o = clamp(Math.min(seg(u, 0.02, 0.14), 1 - seg(u, 0.8, 0.94))); }
      show(el, o);
    });
    if (hint) hint.style.opacity = (1 - seg(x, 0.02, 0.12)).toFixed(3);
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
  (document.fonts ? document.fonts.load('700 230px DM').then(() => document.fonts.ready) : Promise.resolve()).then(() => { printed.forEach(([tex, fn]) => { fn(tex.image.getContext('2d'), tex.image.width, tex.image.height); tex.needsUpdate = true; }); resize(); section.classList.add('story-ready'); });
  resize();
}
