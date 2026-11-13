// normie. scroll-scrubbed 3D intro (beats: cold open, fly-in, hero spin, burst, float, store reveal).
// Every frame is a pure function of scroll progress p (0..1), so scrolling back rewinds exactly.
import * as THREE from './vendor/three.module.js';
import { FLAVORS, makePacket } from './packets3d.js';
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
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;

  // returning visitors get the short version
  try { if (localStorage.getItem('normie-intro-seen')) section.classList.add('intro-short'); } catch (e) {}

  /* ---------- helpers ---------- */
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeIO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const back = t => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const col = h => new THREE.Color(h);

  /* ---------- scene ---------- */
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 400);
  const BG = { void: col('#121a15'), burst: col('#1d2a21'), matcha: col('#5d7a40'), acai: col('#7c2f52'), coffee: col('#7a5233'), cream: col('#f5f2eb') };
  scene.background = BG.void.clone();

  const key = new THREE.DirectionalLight('#ffffff', 3.2); key.position.set(-4, 6, 6); scene.add(key);
  const rim = new THREE.DirectionalLight('#ffffff', 5); scene.add(rim);
  const fill = new THREE.HemisphereLight('#ffffff', '#222222', 0.9); scene.add(fill);
  const glow = new THREE.PointLight('#ffe6b8', 0, 12, 1.5); scene.add(glow);

  /* ---------- box ---------- */
  const BW = 2.5, BH = 1.55, BD = 1.25;
  function boxFace(w, h, kind) {
    const c = document.createElement('canvas'); c.width = Math.round(w * 400); c.height = Math.round(h * 400);
    const g = c.getContext('2d');
    g.fillStyle = '#efe7d8'; g.fillRect(0, 0, c.width, c.height);
    const img = g.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < img.data.length; i += 4) { const n = (Math.random() - .5) * 8; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
    g.putImageData(img, 0, 0);
    g.fillStyle = '#304236'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const bands = [FLAVORS.matcha.pack, FLAVORS.acai.pack, FLAVORS.coffee.pack];
    if (kind === 'front' || kind === 'back') {
      const bw = c.width / 3; bands.forEach((b, i) => { g.fillStyle = b; g.fillRect(i * bw, c.height - 64, bw + 1, 64); });
      g.fillStyle = '#304236';
      g.font = `700 ${Math.round(c.height * 0.36)}px DM, Arial, sans-serif`; g.fillText('normie.', c.width / 2, c.height * 0.42);
      g.font = `400 ${Math.round(c.height * 0.07)}px DM, Arial, sans-serif`; g.globalAlpha = .85;
      g.fillText(kind === 'front' ? 'matcha · açaí · tiramisu coffee' : 'tear. pour. stir.', c.width / 2, c.height * 0.7);
      g.globalAlpha = 1;
    } else if (kind === 'side') {
      const bh = c.height / 3; bands.forEach((b, i) => { g.fillStyle = b; g.fillRect(0, i * bh, c.width, bh + 1); });
      g.save(); g.translate(c.width / 2, c.height / 2); g.rotate(-Math.PI / 2); g.fillStyle = '#304236';
      g.font = `700 ${Math.round(c.width * 0.34)}px DM, Arial, sans-serif`; g.fillText('normie.', 0, 0); g.restore();
    } else if (kind === 'flap') {
      g.fillStyle = '#304236'; g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = '#efe7d8'; g.font = `700 ${Math.round(c.height * 0.34)}px DM, Arial, sans-serif`; g.fillText('normie.', c.width / 2, c.height / 2);
    } else if (kind === 'inside') {
      g.fillStyle = '#d9cdb7'; g.fillRect(0, 0, c.width, c.height);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }
  const paper = map => new THREE.MeshPhysicalMaterial({ map, roughness: .78, clearcoat: .15, clearcoatRoughness: .6 });
  const box = new THREE.Group();
  const sideM = paper(boxFace(BD, BH, 'side')), frontM = paper(boxFace(BW, BH, 'front')), backM = paper(boxFace(BW, BH, 'back'));
  const insideM = new THREE.MeshStandardMaterial({ color: '#cbbd9f', roughness: .9, side: THREE.BackSide });
  const shell = new THREE.Mesh(new THREE.BoxGeometry(BW, BH, BD), [sideM, sideM, insideM, sideM, frontM, backM]);
  // open top: hide the +y face by using an inner liner instead
  shell.geometry.groups = shell.geometry.groups.filter(g => g.materialIndex !== 2);
  box.add(shell);
  const liner = new THREE.Mesh(new THREE.BoxGeometry(BW * .97, BH * .97, BD * .97), insideM); box.add(liner);
  const flapM = paper(boxFace(BW, BD / 2, 'flap'));
  const flaps = [1, -1].map(sz => {
    const pivot = new THREE.Group(); pivot.position.set(0, BH / 2, sz * BD / 2);
    const under = new THREE.MeshStandardMaterial({ color: '#d9cdb7', roughness: .9 });
    const f = new THREE.Mesh(new THREE.BoxGeometry(BW, .025, BD / 2), [under, under, flapM, under, under, under]);
    f.position.z = -sz * BD / 4; pivot.add(f); pivot.userData.sz = sz; box.add(pivot); return pivot;
  });
  scene.add(box);

  /* ---------- packets ---------- */
  const keys = ['matcha', 'acai', 'coffee'];
  const PS = 0.5;
  const packets = [];
  for (let i = 0; i < 12; i++) {
    const k = keys[i % 3];
    const m = makePacket(k); m.scale.setScalar(PS);
    m.traverse(o => { if (o.isMesh) { o.castShadow = false; } });
    const d = { k, i,
      x0: (rnd(i) - .5) * BW * .7, z0: (rnd(i + 30) - .5) * BD * .5,
      vx: (rnd(i + 3) - .5) * 3.4, vy: 7.6 + rnd(i + 4) * 2.6, vz: (rnd(i + 5) - .5) * 2.8 + .6,
      rx: (rnd(i + 6) - .5) * 9, ry: (rnd(i + 7) - .5) * 9, rz: (rnd(i + 8) - .5) * 9,
      t0: 0.445 + (i / 12) * 0.06 };
    m.userData.d = d; m.visible = false; scene.add(m); packets.push(m);
  }
  const heroOf = { matcha: packets[0], acai: packets[1], coffee: packets[2] };

  /* ---------- streaks + ingredient particles ---------- */
  const NS = mobile ? 220 : 420, RANGE = 160;
  const streakGeo = new THREE.BufferGeometry(); const sp = new Float32Array(NS * 6); streakGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const streakMat = new THREE.LineBasicMaterial({ color: '#f2ecd9', transparent: true, opacity: .8 });
  const streaks = new THREE.LineSegments(streakGeo, streakMat); scene.add(streaks);
  const sData = Array.from({ length: NS }, (_, i) => { const a = rnd(i + 900) * Math.PI * 2, r = 2 + rnd(i + 901) * 24; return { x: Math.cos(a) * r, y: Math.sin(a) * r * .7, z: rnd(i + 902) * RANGE }; });

  function cloud(n, color, size, seed) {
    const g = new THREE.BufferGeometry(); const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = (rnd(seed + i) - .5) * 16; a[i * 3 + 1] = (rnd(seed + i + 5e3) - .5) * 14 + 2; a[i * 3 + 2] = (rnd(seed + i + 9e3) - .5) * 10 - 1; }
    g.setAttribute('position', new THREE.BufferAttribute(a, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true }));
    scene.add(pts); return pts;
  }
  const powder = cloud(mobile ? 400 : 900, '#9bbb63', .07, 100);
  const cocoa = cloud(mobile ? 250 : 500, '#5a3a24', .05, 2e4);
  function instanced(geo, color, n, seed) {
    const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color, roughness: .35, transparent: true, opacity: 0 }), n);
    m.userData.items = Array.from({ length: n }, (_, i) => ({ x: (rnd(seed + i) - .5) * 14, y: (rnd(seed + i + 50) - .5) * 12 + 2, z: (rnd(seed + i + 90) - .5) * 9 - 1, s: .7 + rnd(seed + i + 130) * .6, r: rnd(seed + i + 170) * 6 }));
    scene.add(m); return m;
  }
  const berries = instanced(new THREE.SphereGeometry(.09, 16, 12), '#3b1530', mobile ? 24 : 46, 3e4);
  const beanGeo = new THREE.SphereGeometry(.1, 16, 12); beanGeo.scale(1, .62, 1.45);
  const beans = instanced(beanGeo, '#4a2e1b', mobile ? 24 : 46, 4e4);
  const tmp = new THREE.Object3D();

  /* ---------- layout ---------- */
  let W = 0, H = 0;
  function resize() {
    const r = canvas.getBoundingClientRect(); W = r.width; H = r.height;
    renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  function gridTarget(i) {
    const k = i % 3, j = Math.floor(i / 3); // flavor, copy
    if (camera.aspect >= 1) { const idx = k * 4 + j; return new THREE.Vector3((idx - 5.5) * .52, -.55, 0); }
    return new THREE.Vector3((j - 1.5) * .62, 2.45 - k * 1.62, 0);
  }

  /* ---------- overlay ---------- */
  const word = $('.intro-word'), prompt = $('.intro-scroll'), end = $('.intro-end');
  const callouts = Object.fromEntries([...section.querySelectorAll('[data-callout]')].map(el => [el.dataset.callout, el]));
  const style = (el, o, t = '') => { el.style.opacity = o.toFixed(3); el.style.transform = t; el.style.visibility = o < .01 ? 'hidden' : 'visible'; };

  /* ---------- scroll ---------- */
  let target = 0, p = 0;
  const depthMarks = new Set();
  function measure() {
    const r = section.getBoundingClientRect(); const total = r.height - innerHeight;
    target = total > 0 ? clamp(-r.top / total) : 0;
    for (const m of [25, 50, 75, 100]) if (target * 100 >= m - .5 && !depthMarks.has(m)) { depthMarks.add(m); track('intro_depth', String(m)); }
    if (target >= .999) { try { localStorage.setItem('normie-intro-seen', '1'); } catch (e) {} }
  }
  addEventListener('scroll', measure, { passive: true });
  $('.intro-skip').addEventListener('click', () => { track('intro_skip', String(Math.round(target * 100))); scrollTo({ top: section.offsetTop + section.offsetHeight - 40, behavior: 'auto' }); });

  /* ---------- frame ---------- */
  const v = new THREE.Vector3(), q = new THREE.Quaternion(), qFront = new THREE.Quaternion(), e = new THREE.Euler();
  function frame(time) {
    const t = time / 1000;
    const P = p;

    // background
    const bg = scene.background;
    const focus = [['matcha', .57, .645], ['acai', .645, .72], ['coffee', .72, .80]];
    bg.copy(BG.void).lerp(BG.burst, seg(P, .38, .5));
    focus.forEach(([k, a, b]) => { const w = Math.sin(seg(P, a - .02, b + .02) * Math.PI); bg.lerp(BG[k], w * .9); });
    bg.lerp(BG.cream, easeIO(seg(P, .82, .95)));

    // camera path
    let cx = 0, cy = 0, cz = 12, lx = 0, ly = 0, lz = 0;
    const fly = seg(P, .10, .25), spin = seg(P, .25, .40), burst = seg(P, .40, .55), fl = seg(P, .55, .80), rev = seg(P, .80, .96);
    cz = lerp(12, 14, easeOut(seg(P, .10, .17))); cz = lerp(cz, 9.5, easeIO(seg(P, .17, .25)));
    cy = lerp(0, -1.3, easeIO(spin)); ly = lerp(0, .3, easeIO(spin));
    // burst: push into the opening, then tilt up with the packets
    cy = lerp(cy, 1.6, easeIO(seg(P, .40, .47))); cz = lerp(cz, 6.4, easeIO(seg(P, .40, .47)));
    ly = lerp(ly, 5.2, easeIO(seg(P, .46, .55))); cy = lerp(cy, 3.8, easeIO(seg(P, .47, .55))); cz = lerp(cz, 10, easeIO(seg(P, .47, .55)));
    // float: fall with the packets
    cy = lerp(cy, 1.4, easeIO(fl)); ly = lerp(ly, 1.6, easeIO(fl)); cx = Math.sin(fl * Math.PI * 1.5) * 1.2 * (1 - rev);
    // reveal: front-on
    cx = lerp(cx, 0, easeIO(rev)); cy = lerp(cy, 0, easeIO(rev)); ly = lerp(ly, 0, easeIO(rev)); lx = 0;
    const por = camera.aspect < 1;
    if (por) { cz *= 1.8; cy *= 1.2; }
    cz = lerp(cz, por ? 14 : 9.2, easeIO(rev));
    cx += Math.sin(t * .4) * .06 * (1 - rev); cy += Math.cos(t * .5) * .04 * (1 - rev);
    camera.position.set(cx, cy, cz); camera.lookAt(lx, ly, lz);

    // rim light orbit
    const ra = t * .6 + P * 12; rim.position.set(Math.cos(ra) * 8, 4, Math.sin(ra) * 8 - 2);
    const fc = focus.reduce((acc, [k, a, b]) => P >= a && P < b ? k : acc, null);
    fill.color.set(fc ? FLAVORS[fc].pack : '#ffffff'); fill.intensity = lerp(.9, 1.6, fc ? 1 : 0) * lerp(1, 1.1, rev);
    rim.intensity = lerp(5, 1.4, rev); key.intensity = lerp(3.2, 2.4, rev);

    // streaks: fast in cold open + fly-in, fade after
    const speed = lerp(2.2, .25, seg(P, .0, .1)) + Math.sin(seg(P, .1, .25) * Math.PI) * 5;
    const travel = P * 900 + t * 6;
    const sAlpha = (1 - seg(P, .26, .34)) * .85 + seg(P, .44, .5) * (1 - seg(P, .55, .62)) * .4;
    streakMat.opacity = sAlpha; streaks.visible = sAlpha > .01;
    if (streaks.visible) {
      for (let i = 0; i < NS; i++) { const s = sData[i]; let z = ((s.z + travel) % RANGE) - RANGE + 10; const len = .2 + speed * (.5 + rnd(i) * .8);
        sp.set([s.x, s.y, z - 40, s.x, s.y, z - 40 + len], i * 6); }
      streakGeo.attributes.position.needsUpdate = true;
    }

    // box
    const fb = back(fly);
    box.visible = P >= .1 && (P < .58 || (P > .82 && camera.aspect >= 1));
    box.position.set(0, 0, lerp(-90, 0, fb));
    box.rotation.set((1 - easeOut(fly)) * 9, (1 - easeOut(fly)) * 13 + easeIO(spin) * Math.PI * 2, (1 - easeOut(fly)) * 3);
    box.rotation.x += lerp(0, .12, spin) * (1 - burst);
    const open = back(seg(P, .40, .46));
    flaps.forEach(f => { f.rotation.x = f.userData.sz * open * 2.1; });
    glow.position.set(0, BH / 2 + .2, 0); glow.intensity = Math.sin(seg(P, .41, .58) * Math.PI) * 60;
    if (P > .8) {
      const land = back(seg(P, .84, .95));
      box.position.set(0, camera.aspect >= 1 ? lerp(-9, -1.95, land) : lerp(-12, -3.6, land), 1.2);
      box.rotation.set(.08, 0, 0); box.scale.setScalar(camera.aspect >= 1 ? .55 : .5);
      flaps.forEach(f => { f.rotation.x = 0; });
    } else box.scale.setScalar(1);

    // packets
    packets.forEach((m, i) => {
      const d = m.userData.d;
      if (P < d.t0) { m.visible = false; return; }
      m.visible = true;
      // ballistic launch to the end of the burst beat, then slow zero-g drift
      const T = Math.min(P, .55) - d.t0; const tt = T * 11;
      v.set(d.x0 + d.vx * tt, BH / 2 + d.vy * tt - 6.2 * tt * tt * .5, d.z0 + d.vz * tt);
      const fT = seg(P, .55, 1);
      v.x += Math.sin(fT * 5 + i) * .5 * fT; v.y -= fT * (3.2 + rnd(i + 11) * 1.6); v.z += Math.cos(fT * 4 + i) * .4 * fT;
      v.y += Math.sin(t * .8 + i) * .05;
      e.set(d.rx * (P - d.t0) * 3 + t * .15, d.ry * (P - d.t0) * 3, d.rz * (P - d.t0) * 3);
      q.setFromEuler(e);
      // flavor hero pass near the camera
      focus.forEach(([k, a, b]) => {
        if (heroOf[k] !== m) return;
        const w = easeIO(Math.sin(seg(P, a, b) * Math.PI));
        if (w <= 0) return;
        const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
        const near = camera.position.clone().add(dir.multiplyScalar(camera.aspect >= 1 ? 3.2 : 4.6)); near.x += camera.aspect >= 1 ? -.9 : 0; near.y += camera.aspect >= 1 ? 0 : -.55;
        v.lerp(near, w);
        qFront.setFromEuler(new THREE.Euler(0, Math.sin(seg(P, a, b) * Math.PI * 2) * .35, .12)); q.slerp(qFront, w);
      });
      // settle into the grid
      const g = easeIO(seg(P, .80 + (i % 12) * .004, .94 + (i % 12) * .002));
      if (g > 0) { v.lerp(gridTarget(i), g); qFront.identity(); q.slerp(qFront, g); }
      m.position.copy(v); m.quaternion.copy(q);
      const hk = focus.find(([k]) => heroOf[k] === m); const hw = hk ? easeIO(Math.sin(seg(P, hk[1], hk[2]) * Math.PI)) : 0;
      m.scale.setScalar(PS * lerp(1, camera.aspect >= 1 ? .95 : .85, g) * (1 + hw * (camera.aspect >= 1 ? .9 : .25)));
    });

    // ingredients
    const ing = Math.sin(seg(P, .53, .82) * Math.PI);
    const fw = k => { const f = focus.find(x => x[0] === k); return Math.sin(seg(P, f[1] - .03, f[2] + .03) * Math.PI); };
    powder.material.opacity = ing * (.25 + .75 * fw('matcha')); powder.rotation.y = t * .03 + P * 2; powder.position.y = -P * 4 + 2;
    cocoa.material.opacity = ing * (.15 + .7 * fw('coffee')); cocoa.rotation.y = -t * .02 - P * 1.5; cocoa.position.y = -P * 3 + 1.6;
    [[berries, 'acai'], [beans, 'coffee']].forEach(([im, k]) => {
      const a = ing * (.3 + .7 * fw(k)); im.material.opacity = a; im.visible = a > .01;
      if (!im.visible) return;
      im.userData.items.forEach((it, j) => {
        tmp.position.set(it.x + Math.sin(t * .3 + j) * .2, it.y - P * 4 + 2 + Math.sin(t * .5 + j) * .15, it.z);
        tmp.rotation.set(it.r + t * .4, it.r * 2 + t * .3, 0); tmp.scale.setScalar(it.s * (1 + fw(k) * .4));
        tmp.updateMatrix(); im.setMatrixAt(j, tmp.matrix);
      });
      im.instanceMatrix.needsUpdate = true;
    });

    // overlay
    const slam = seg(P, 0, .035);
    const wOut = seg(P, .07, .13);
    const wLoad = section.classList.contains('intro-ready') ? 1 : 0;
    style(word, wLoad * (1 - wOut), `translate(-50%,-50%) scale(${(lerp(1.5, 1, back(Math.max(slam, .0001))) * lerp(1, 1.6, wOut)).toFixed(3)})`);
    style(prompt, wLoad * (1 - seg(P, .02, .07)));
    focus.forEach(([k, a, b]) => { const w = Math.sin(seg(P, a + .005, b - .005) * Math.PI); style(callouts[k], clamp(w * 1.6), `translateY(${((1 - w) * 30).toFixed(1)}px)`); });
    const eIn = seg(P, .9, .98);
    style(end, eIn, `translateY(${((1 - easeOut(eIn)) * 24).toFixed(1)}px)`);
    end.style.pointerEvents = eIn > .5 ? 'auto' : 'none';
    section.classList.toggle('intro-light', P > .88);

    renderer.render(scene, camera);
  }

  /* ---------- loop ---------- */
  let visible = true, raf = 0, ready = false;
  const loop = time => {
    p += (target - p) * (Math.abs(target - p) > .3 ? .25 : .12); // scrub smoothing
    if (Math.abs(target - p) < 1e-4) p = target;
    frame(time);
    if (!ready) { ready = true; requestAnimationFrame(() => section.classList.add('intro-ready')); }
    raf = visible ? requestAnimationFrame(loop) : 0;
  };
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; document.body.classList.toggle('intro-active', visible); if (visible && !raf) raf = requestAnimationFrame(loop); }).observe(section);
  // test hook: render a given progress synchronously
  window.__normieIntro = { set(x) { target = p = clamp(x); frame(performance.now()); } };
  resize(); measure(); p = target;
  raf = requestAnimationFrame(loop);
}
