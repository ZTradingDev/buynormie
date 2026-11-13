// normie. 3D studio + depth interactions
// Interactive WebGL drink sticks (drag, pick, tear & pour), card tilt, hero parallax.
import * as THREE from './vendor/three.module.js';

const ROOT = new URL('./', import.meta.url).href;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

import { FLAVORS, ORDER, labelTexture, makePacket, W, D, BODY_H, CAP_H, SEAL } from './packets3d.js?v=20261113a';

/* ---------- sunlit backdrop (wall + floor with window and branch shadows) ---------- */
let backdropURL = '';
function backdrop() {
  if (backdropURL) return backdropURL;
  const c = document.createElement('canvas'); c.width = 1600; c.height = 1000;
  const g = c.getContext('2d');
  const wall = g.createLinearGradient(0, 0, 0, 700);
  wall.addColorStop(0, '#e6d8c2'); wall.addColorStop(1, '#efe5d4');
  g.fillStyle = wall; g.fillRect(0, 0, 1600, 1000);
  const floor = g.createLinearGradient(0, 700, 0, 1000);
  floor.addColorStop(0, '#ece2d0'); floor.addColorStop(1, '#f3ecdf');
  g.fillStyle = floor; g.fillRect(0, 700, 1600, 300);
  g.fillStyle = 'rgba(120,90,55,0.06)'; g.fillRect(0, 696, 1600, 8);
  // light spill
  const spill = g.createRadialGradient(560, 380, 40, 560, 380, 900);
  spill.addColorStop(0, 'rgba(255,248,232,0.75)'); spill.addColorStop(1, 'rgba(255,248,232,0)');
  g.fillStyle = spill; g.fillRect(0, 0, 1600, 1000);
  // window frame + branch shadows, softly blurred
  g.save(); g.filter = 'blur(22px)'; g.strokeStyle = 'rgba(112,82,48,0.16)'; g.lineCap = 'round';
  g.translate(800, 380); g.rotate(-0.42); g.translate(-800, -380);
  g.lineWidth = 46; [[-200, 0], [420, 0], [1040, 0]].forEach(([x]) => { g.beginPath(); g.moveTo(x, -400); g.lineTo(x, 1400); g.stroke(); });
  g.lineWidth = 34; g.beginPath(); g.moveTo(-400, 520); g.lineTo(2000, 520); g.stroke();
  g.lineWidth = 14;
  const branch = (x, y, a, len, depth) => {
    if (depth === 0 || len < 20) return;
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    g.lineWidth = depth * 4; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + x2) / 2 + 30, (y + y2) / 2 - 20, x2, y2); g.stroke();
    branch(x2, y2, a - 0.5, len * 0.7, depth - 1); branch(x2, y2, a + 0.42, len * 0.66, depth - 1);
  };
  branch(1500, 60, 2.6, 260, 5); branch(-60, 120, 0.35, 240, 4);
  g.restore();
  // floor shadow streaks
  g.save(); g.filter = 'blur(10px)'; g.fillStyle = 'rgba(112,82,48,0.10)';
  g.beginPath(); g.ellipse(980, 880, 520, 10, -0.02, 0, 6.283); g.fill(); g.restore();
  backdropURL = c.toDataURL('image/jpeg', 0.86);
  return backdropURL;
}

/* ---------- studio ---------- */
function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
const clamp01 = t => Math.min(1, Math.max(0, t));
const lerp = (a, b, t) => a + (b - a) * t;

function initStudio(root) {
  const mode = root.dataset.studio; // 'all' or a flavor key
  const canvas = root.querySelector('.studio-canvas');
  const stageEl = root.querySelector('.studio-stage');
  if (!root.hasAttribute('data-bare')) stageEl.style.backgroundImage = `url(${backdrop()})`;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { root.classList.add('studio-fallback'); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.VSMShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  scene.add(new THREE.HemisphereLight('#fff7ea', '#d9c9ad', 1.5));
  const sun = new THREE.DirectionalLight('#fff4e2', 2.4);
  sun.position.set(-3, 7, 3.5); sun.castShadow = true; sun.shadow.blurSamples = 20;
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -4; sun.shadow.camera.right = 4;
  sun.shadow.camera.top = 4; sun.shadow.camera.bottom = -4; sun.shadow.radius = 14; sun.shadow.bias = -0.0005;
  scene.add(sun);
  const rim = new THREE.DirectionalLight('#ffffff', 1.6); rim.position.set(4, 3, -4); scene.add(rim);
  const fill = new THREE.DirectionalLight('#ffe9d2', 0.7); fill.position.set(5, 2, 5); scene.add(fill);

  const world = new THREE.Group(); scene.add(world);
  // stone plinth
  const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.ShadowMaterial({ color: '#6b5236', opacity: 0.2 }));
  shadowPlane.rotation.x = -Math.PI / 2; shadowPlane.position.y = 0; shadowPlane.receiveShadow = true; world.add(shadowPlane);

  // glass + drink
  const GLASS_H = 1.25, GR = 0.5;
  const glass = new THREE.Group();
  const prof = [new THREE.Vector2(0, 0), new THREE.Vector2(GR * 0.86, 0), new THREE.Vector2(GR * 0.9, 0.06), new THREE.Vector2(GR, GLASS_H), new THREE.Vector2(GR * 0.96, GLASS_H)];
  const glassMesh = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1 }));
  glassMesh.renderOrder = 3;
  const rimRing = new THREE.Mesh(new THREE.TorusGeometry(GR * 0.98, 0.012, 8, 64), new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, roughness: 0.1 }));
  rimRing.rotation.x = Math.PI / 2; rimRing.position.y = GLASS_H;
  const liquidMat = new THREE.MeshStandardMaterial({ color: '#9dbb72', roughness: 0.35, transparent: true, opacity: 0.92 });
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(GR * 0.95, GR * 0.86, 1, 48), liquidMat);
  liquid.position.y = 0.06; liquid.scale.y = 0.0001; liquid.visible = false; liquid.renderOrder = 2;
  const foamMat = new THREE.MeshStandardMaterial({ color: '#c9d9a8', roughness: 0.6 });
  const foam = new THREE.Mesh(new THREE.CircleGeometry(GR * 0.95, 48), foamMat);
  foam.rotation.x = -Math.PI / 2; foam.visible = false; foam.renderOrder = 2;
  const ice = [];
  for (let i = 0; i < 3; i++) {
    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, roughness: 0.15 }));
    cube.position.set(Math.cos(i * 2.1) * 0.2, 0.4 + i * 0.22, Math.sin(i * 2.1) * 0.2);
    cube.rotation.set(i, i * 0.7, i * 0.3); cube.renderOrder = 2; ice.push(cube); glass.add(cube);
  }
  glass.add(liquid, foam, glassMesh, rimRing);
  world.add(glass); glass.visible = false; glass.scale.setScalar(0.001);
  glassMesh.castShadow = false;

  // packets
  const keys = mode === 'all' ? ORDER : [mode];
  const packets = keys.map(k => {
    const p = makePacket(k); world.add(p); return p;
  });
  const layout = () => {
    if (mode === 'all') {
      glass.position.set(0.55, 0, 1.15);
      packets.forEach((p, i) => { p.userData.rest = new THREE.Vector3(-1.3 + i * 1.3, BODY_H / 2 + 0.75, 0); p.userData.restRot = (i - 1) * -0.12; p.userData.restZ = (1 - i) * 0.06; });
    } else {
      glass.position.set(0.75, 0, 0.7);
      packets[0].userData.rest = new THREE.Vector3(0, BODY_H / 2 + 0.75, 0); packets[0].userData.restRot = 0.12; packets[0].userData.restZ = 0.05;
    }
    packets.forEach(p => { p.position.copy(p.userData.rest); p.rotation.set(0, p.userData.restRot, p.userData.restZ); });
  };
  layout();

  // powder particles
  const N = 900;
  const pGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), life = new Float32Array(N);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pMat = new THREE.PointsMaterial({ color: '#86a35a', size: 0.035, sizeAttenuation: true, transparent: true, opacity: 0.95, depthWrite: false });
  const points = new THREE.Points(pGeo, pMat); points.frustumCulled = false; world.add(points);
  for (let i = 0; i < N; i++) pos[i * 3 + 1] = -99;
  let emitIdx = 0;

  // state
  let selected = mode === 'all' ? 0 : 0;
  let hovered = -1;
  let seq = null; // pour sequence
  let poured = false;
  const ui = {
    chips: [...root.querySelectorAll('[data-studio-pick]')],
    pour: root.querySelector('[data-studio-pour]'),
    name: root.querySelector('.studio-name'),
    note: root.querySelector('.studio-note'),
    link: root.querySelector('.studio-link'),
    status: root.querySelector('.studio-status'),
  };

  function applyFlavor() {
    const f = FLAVORS[keys[selected]];
    stageEl.style.setProperty('--stage', f.stage);
    stageEl.style.setProperty('--stage-ink', f.ink);
    pMat.color.set(f.powder); liquidMat.color.set(f.drink); foamMat.color.set(f.drinkTop);
    if (ui.name) ui.name.textContent = f.name;
    if (ui.note) ui.note.textContent = f.note;
    if (ui.link && ui.link.hasAttribute('data-order')) { ui.link.href = `#order-${keys[selected]}`; ui.link.textContent = `order ${f.name} ↓`; }
    else if (ui.link) { ui.link.href = `${ROOT}products/${keys[selected]}/index.html`; ui.link.textContent = `see ${f.name} ↗`; }
    ui.chips.forEach(c => c.setAttribute('aria-pressed', String(c.dataset.studioPick === keys[selected])));
  }
  function select(i) {
    if (seq) return;
    if (poured) resetPour(true);
    selected = i; applyFlavor();
    if (ui.status) ui.status.textContent = `${FLAVORS[keys[i]].name} selected.`;
  }
  ui.chips.forEach(c => c.addEventListener('click', () => select(keys.indexOf(c.dataset.studioPick))));

  function setPourLabel(t) { if (ui.pour) ui.pour.querySelector('span').textContent = t; }
  function resetPour(silent) {
    seq = null; poured = false;
    packets.forEach(p => {
      const cap = p.userData.cap; cap.visible = true; cap.position.copy(cap.userData.home); cap.rotation.set(0, 0, 0);
      cap.children.forEach(m => { m.material.transparent = false; m.material.opacity = 1; });
      p.userData.notch.visible = true;
    });
    liquid.visible = false; liquid.scale.y = 0.0001; foam.visible = false; glass.visible = false; glass.scale.setScalar(0.001);
    ice.forEach((c, i) => c.position.y = 0.4 + i * 0.22);
    for (let i = 0; i < N; i++) { pos[i * 3 + 1] = -99; life[i] = 0; }
    setPourLabel('tear & pour');
    if (!silent && ui.status) ui.status.textContent = 'Reset. The stick is sealed again.';
  }
  function startPour() {
    if (seq) return;
    if (poured) { resetPour(); return; }
    const p = packets[selected];
    p.userData.cap.children.forEach(m => { if (!m.userData.own) { m.material = m.material.clone(); m.userData.own = true; } });
    seq = { t: 0, p, from: p.position.clone(), fromRot: p.rotation.clone(), capFlyX: (Math.random() < 0.5 ? -1 : 1) };
    liquid.visible = true; foam.visible = true; glass.visible = true;
    if (ui.pour) ui.pour.disabled = true;
    if (ui.status) ui.status.textContent = `Tearing open ${FLAVORS[keys[selected]].name} and pouring.`;
  }
  ui.pour && ui.pour.addEventListener('click', startPour);

  // pointer: drag to rotate, hover + click to pick
  let yaw = mode === 'all' ? 0 : -0.15, yawV = 0, pitch = 0.0, dragging = false, moved = 0, lastX = 0, lastY = 0, autoSpin = false;
  let px = 0, py = 0; // parallax
  const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
  function pick(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(packets, true);
    if (!hits.length) return -1;
    let o = hits[0].object; while (o && !packets.includes(o)) o = o.parent;
    return packets.indexOf(o);
  }
  canvas.addEventListener('pointerdown', e => { dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY; autoSpin = false; canvas.setPointerCapture(e.pointerId); root.classList.add('studio-touched'); });
  canvas.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect();
    px = ((e.clientX - r.left) / r.width - 0.5); py = ((e.clientY - r.top) / r.height - 0.5);
    if (dragging) {
      const dx = e.clientX - lastX, dy = e.clientY - lastY; moved += Math.abs(dx) + Math.abs(dy);
      yawV = dx * 0.006; yaw += dx * 0.006; pitch = Math.max(-0.25, Math.min(0.35, pitch + dy * 0.003));
      lastX = e.clientX; lastY = e.clientY;
    } else if (finePointer && !seq) {
      hovered = pick(e); canvas.style.cursor = hovered >= 0 ? 'pointer' : 'grab';
    }
  });
  const end = e => {
    if (!dragging) return; dragging = false;
    if (moved < 6) { const i = pick(e); if (i >= 0 && mode === 'all') select(i); }
  };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', () => dragging = false);
  canvas.addEventListener('pointerleave', () => { hovered = -1; px = py = 0; });
  canvas.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { yaw -= 0.2; autoSpin = false; }
    else if (e.key === 'ArrowRight') { yaw += 0.2; autoSpin = false; }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startPour(); }
  });

  // sizing
  function resize() {
    const w = stageEl.clientWidth, h = stageEl.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const dist = (mode === 'all' ? 10.2 : 8.2) * Math.max(1, 1.45 / camera.aspect) * (parseFloat(root.dataset.zoom) || 1);
    camera.position.set(0, 2.2, dist); camera.lookAt(0, 1.62, 0);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stageEl); resize();

  let visible = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) loop(); }, { rootMargin: '100px' }).observe(stageEl);

  const tmp = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
  const clock = new THREE.Clock();
  let raf = 0, elapsed = 0;

  function emit(origin, dir, count) {
    for (let k = 0; k < count; k++) {
      const i = emitIdx; emitIdx = (emitIdx + 1) % N;
      pos[i * 3] = origin.x + (Math.random() - 0.5) * 0.18;
      pos[i * 3 + 1] = origin.y + (Math.random() - 0.5) * 0.04;
      pos[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.08;
      vel[i * 3] = dir.x * 0.6 + (Math.random() - 0.5) * 0.25;
      vel[i * 3 + 1] = dir.y * 0.6 - Math.random() * 0.3;
      vel[i * 3 + 2] = dir.z * 0.6 + (Math.random() - 0.5) * 0.25;
      life[i] = 1;
    }
  }

  function stepSequence(dt) {
    const s = seq; s.t += dt * (reduced ? 2.2 : 1);
    const p = s.p, t = s.t, cap = p.userData.cap;
    const gs = easeInOut(clamp01(t / 0.8)); glass.scale.set(Math.max(0.001, gs), Math.max(0.001, gs), Math.max(0.001, gs));
    const glassTop = new THREE.Vector3(glass.position.x, GLASS_H, glass.position.z);
    // A: lift over glass (0-1.0)
    const a = easeInOut(clamp01(t / 1.0));
    // C: tilt (1.6-2.3)
    const c = easeInOut(clamp01((t - 1.6) / 0.7));
    // E: return (4.8-5.8)
    const e = easeInOut(clamp01((t - 4.8) / 1.0));
    const tiltZ = lerp(-0.25 * a, 2.55, c);
    const pourRot = new THREE.Euler(0, lerp(s.fromRot.y, 0, a), tiltZ * (1 - e));
    p.rotation.copy(pourRot);
    // target so that opening sits above glass during pour
    const hover = new THREE.Vector3(glassTop.x - 0.75, glassTop.y + 1.0, glassTop.z);
    const openLocal = p.userData.opening.clone().applyEuler(pourRot);
    const pourPos = glassTop.clone().add(new THREE.Vector3(-0.08, 0.4, 0)).sub(openLocal);
    const mid = s.from.clone().lerp(hover, a);
    const target = mid.lerp(pourPos, c);
    p.position.copy(target.lerp(p.userData.rest, e));
    // B: tear cap (1.0-1.6), then it drifts away and fades
    const b = clamp01((t - 1.0) / 0.6);
    if (b > 0) {
      p.userData.notch.visible = false;
      const fly = easeInOut(b);
      cap.position.set(cap.userData.home.x + 0.55 * fly * s.capFlyX, cap.userData.home.y + 0.35 * Math.sin(fly * Math.PI) + 0.25 * fly, 0.15 * fly);
      cap.rotation.set(0.4 * fly, 0, -1.1 * fly * s.capFlyX);
      const fade = clamp01((t - 1.5) / 0.6);
      cap.children.forEach(m => { m.material.transparent = true; m.material.opacity = 1 - fade; });
      if (fade >= 1) cap.visible = false;
    }
    // D: powder stream (2.0-4.4)
    if (t > 2.0 && t < 4.4) {
      p.updateMatrixWorld();
      const o = p.userData.opening.clone().applyMatrix4(p.matrixWorld);
      world.worldToLocal(o);
      emit(o, new THREE.Vector3(0.05, -1, 0), reduced ? 6 : 14);
    }
    // liquid level
    const fill = easeInOut(clamp01((t - 2.3) / 2.6));
    const level = 0.06 + fill * 0.95;
    liquid.scale.y = Math.max(0.0001, level - 0.06); liquid.position.y = 0.06 + (level - 0.06) / 2;
    foam.position.y = level + 0.002;
    ice.forEach((cube, i) => { cube.position.y = Math.max(0.4 + i * 0.22, level - 0.08 + Math.sin(elapsed * 2 + i) * 0.02); });
    if (t > 5.8) {
      seq = null; poured = true; setPourLabel('reset stick');
      if (ui.pour) { ui.pour.disabled = false; }
      if (ui.status) ui.status.textContent = `Poured. Your ${FLAVORS[keys[selected]].name} is ready.`;
    }
  }

  function loop() {
    if (raf || !visible) return;
    const frame = () => {
      raf = 0;
      if (!visible || document.hidden) return;
      const dt = Math.min(clock.getDelta(), 0.05); elapsed += dt;
      if (autoSpin && !seq) yaw += dt * 0.12;
      if (!dragging) { yaw += yawV; yawV *= 0.92; }
      world.rotation.y = lerp(world.rotation.y, yaw + px * 0.25, 0.12);
      world.rotation.x = lerp(world.rotation.x, pitch + py * 0.08, 0.1);

      packets.forEach((p, i) => {
        if (seq && seq.p === p) return;
        const isSel = mode === 'all' && i === selected;
        const lift = (isSel ? 0.22 : 0) + (i === hovered ? 0.12 : 0);
        const fwd = isSel ? 0.45 : 0;
        const bob = reduced ? 0 : Math.sin(elapsed * 1.1 + i * 1.7) * 0.06;
        const rest = p.userData.rest;
        p.position.x = lerp(p.position.x, rest.x, 0.12);
        p.position.y = lerp(p.position.y, rest.y + lift + bob, 0.12);
        p.position.z = lerp(p.position.z, rest.z + fwd, 0.12);
        const sway = reduced ? 0 : Math.sin(elapsed * 0.7 + i * 2.1);
        const targetRot = p.userData.restRot + sway * (isSel ? 0.5 : 0.22);
        p.rotation.y = lerp(p.rotation.y, targetRot, 0.08);
        p.rotation.z = lerp(p.rotation.z, p.userData.restZ + (reduced ? 0 : Math.sin(elapsed * 0.9 + i * 1.3) * 0.05), 0.08);
        p.rotation.x = lerp(p.rotation.x, reduced ? 0 : Math.sin(elapsed * 0.6 + i) * 0.06, 0.08);
      });
      if (seq) stepSequence(dt);

      // particles
      const surface = liquid.visible ? liquid.position.y + liquid.scale.y / 2 : 0.06;
      for (let i = 0; i < N; i++) {
        if (life[i] <= 0) continue;
        vel[i * 3 + 1] -= 9.8 * dt * 0.55;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        const dx = pos[i * 3] - glass.position.x, dz = pos[i * 3 + 2] - glass.position.z;
        if (pos[i * 3 + 1] < GLASS_H && dx * dx + dz * dz < GR * GR) {
          vel[i * 3] *= 0.5; vel[i * 3 + 2] *= 0.5;
          // keep inside glass
          const r = Math.sqrt(dx * dx + dz * dz); if (r > GR * 0.85) { pos[i * 3] = glass.position.x + dx / r * GR * 0.85; pos[i * 3 + 2] = glass.position.z + dz / r * GR * 0.85; }
        }
        if (pos[i * 3 + 1] < surface || pos[i * 3 + 1] < -0.3) { life[i] = 0; pos[i * 3 + 1] = -99; }
      }
      pGeo.attributes.position.needsUpdate = true;
      liquid.rotation.y += dt * 0.6;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    clock.getDelta();
    raf = requestAnimationFrame(frame);
  }

  applyFlavor();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loop(); });
  // repaint labels once the brand font is ready
  document.fonts && Promise.all(['700 200px DM','400 30px DM'].map(x => document.fonts.load(x))).then(() => {
    packets.forEach(p => {
      const f = FLAVORS[p.userData.key];
      p.userData.front.map.dispose(); p.userData.front.map = labelTexture(f, false, p.userData.key); p.userData.front.needsUpdate = true;
      p.userData.back.map.dispose(); p.userData.back.map = labelTexture(f, true, p.userData.key); p.userData.back.needsUpdate = true;
    });
  }).catch(() => {});
  root.classList.add('studio-ready');
  loop();
}

/* ---------- depth: card tilt + hero parallax ---------- */
function initTilt() {
  if (reduced || !finePointer) return;
  document.querySelectorAll('.product-card .card-image, .gallery-main, .mega-products .image-frame').forEach(el => {
    el.classList.add('tilt');
    if (!el.querySelector('.tilt-glare')) { const g = document.createElement('span'); g.className = 'tilt-glare'; g.setAttribute('aria-hidden', 'true'); el.appendChild(g); }
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.setProperty('--rx', `${(0.5 - y) * 9}deg`);
      el.style.setProperty('--ry', `${(x - 0.5) * 11}deg`);
      el.style.setProperty('--gx', `${x * 100}%`); el.style.setProperty('--gy', `${y * 100}%`);
      el.classList.add('tilting');
    });
    el.addEventListener('pointerleave', () => { el.classList.remove('tilting'); el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
  });
}
function initHeroDepth() {
  if (reduced || !finePointer) return;
  const hero = document.querySelector('.hero'); if (!hero) return;
  const media = hero.querySelector('.hero-media img'), copy = hero.querySelector('.hero-copy');
  hero.classList.add('hero-depth');
  let tx = 0, ty = 0, cx = 0, cy = 0, running = false;
  const tick = () => {
    cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
    if (media) media.style.transform = `scale(1.06) translate3d(${cx * -14}px, ${cy * -10}px, 0)`;
    if (copy) copy.style.transform = `translate3d(${cx * 10}px, ${cy * 6}px, 0)`;
    if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) requestAnimationFrame(tick); else running = false;
  };
  hero.addEventListener('pointermove', e => {
    const r = hero.getBoundingClientRect();
    tx = (e.clientX - r.left) / r.width - 0.5; ty = (e.clientY - r.top) / r.height - 0.5;
    if (!running) { running = true; requestAnimationFrame(tick); }
  });
  hero.addEventListener('pointerleave', () => { tx = ty = 0; if (!running) { running = true; requestAnimationFrame(tick); } });
}

/* ---------- pinned scroll sequence (hero out, studio rises in) ---------- */
const smooth = t => t * t * (3 - 2 * t);
const seg = (p, a, b) => smooth(clamp01((p - a) / (b - a)));

function initDust(canvas) {
  const g = canvas.getContext('2d');
  const cols = ['#86a35a', '#c98f9a', '#b8936a', '#304236'];
  let parts = [], w = 0, h = 0, dpr = 1;
  const size = () => {
    dpr = Math.min(devicePixelRatio || 1, 2); w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const n = Math.round(w * h / 5200);
    parts = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, z: 0.3 + Math.random() * 0.7, r: 0.6 + Math.random() * 1.8, c: cols[(Math.random() * cols.length) | 0], s: Math.random() * 6.28 }));
  };
  new ResizeObserver(size).observe(canvas); size();
  return (progress, time) => {
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    for (const p of parts) {
      const y = ((p.y - progress * 420 * p.z - time * 8 * p.z) % h + h) % h;
      const x = p.x + Math.sin(time * 0.6 + p.s) * 6 * p.z;
      g.globalAlpha = 0.25 + p.z * 0.5; g.fillStyle = p.c;
      g.beginPath(); g.arc(x, y, p.r * p.z, 0, 6.283); g.fill();
    }
  };
}

function initPin() {
  const pin = document.querySelector('[data-pin]'); if (!pin) return;
  const wide = matchMedia('(min-width: 900px)');
  const hero = pin.querySelector('.pin-hero'), stage = pin.querySelector('.pin-stage');
  const panel = stage.querySelector('.studio'), rise = [...stage.querySelectorAll('[data-rise]')];
  const dustCanvas = pin.querySelector('.pin-dust');
  const drawDust = initDust(dustCanvas);
  let cur = 0, target = 0, raf = 0, on = false;
  const clear = () => {
    [hero, stage, panel, dustCanvas, ...rise].forEach(el => { el.style.transform = el.style.opacity = el.style.filter = el.style.pointerEvents = ''; });
  };
  const measure = () => {
    const r = pin.getBoundingClientRect();
    const travel = pin.offsetHeight - pin.querySelector('.pin-sticky').offsetHeight;
    const top = parseFloat(getComputedStyle(pin.querySelector('.pin-sticky')).top) || 0;
    target = clamp01((top - r.top) / Math.max(1, travel));
  };
  const render = () => {
    raf = 0;
    cur += (target - cur) * 0.14;
    if (Math.abs(target - cur) < 0.0004) cur = target;
    const p = cur;
    const a = seg(p, 0, 0.26);
    hero.style.opacity = String(1 - a);
    hero.style.filter = a > 0.001 ? `blur(${(a * 10).toFixed(2)}px)` : '';
    hero.style.transform = `translate3d(0, ${(-90 * a).toFixed(1)}px, 0) scale(${(1 - 0.04 * a).toFixed(4)})`;
    hero.style.pointerEvents = a > 0.5 ? 'none' : '';
    const d = 0.62 * seg(p, 0, 0.22) - 0.42 * seg(p, 0.42, 0.68);
    dustCanvas.style.opacity = d.toFixed(3);
    if (d > 0.01) drawDust(p, performance.now() / 1000);
    const b = seg(p, 0.26, 0.6);
    stage.style.opacity = Math.min(1, b * 2.2).toFixed(3);
    stage.style.pointerEvents = b > 0.6 ? 'auto' : 'none';
    panel.style.transform = `translate3d(0, ${(70 * (1 - b)).toFixed(1)}px, 0) scale(${(0.42 + 0.58 * b).toFixed(4)}) rotateX(${(34 * (1 - b)).toFixed(2)}deg)`;
    rise.forEach((el, i) => {
      const e = seg(p, 0.42 + i * 0.035, 0.6 + i * 0.035);
      el.style.opacity = e.toFixed(3);
      el.style.transform = `translate3d(0, ${(28 * (1 - e)).toFixed(1)}px, 0)`;
    });
    if (cur !== target || d > 0.01) raf = requestAnimationFrame(render);
  };
  const kick = () => { if (!on) return; measure(); if (!raf) raf = requestAnimationFrame(render); };
  const setMode = () => {
    on = wide.matches && !reduced;
    pin.classList.toggle('pin-off', !on);
    if (!on) { cancelAnimationFrame(raf); raf = 0; clear(); return; }
    measure(); cur = target; render();
  };
  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', kick);
  wide.addEventListener('change', setMode);
  // keyboard users: jump to the revealed studio when focus enters it
  stage.addEventListener('focusin', () => {
    if (!on || cur > 0.6) return;
    const travel = pin.offsetHeight - pin.querySelector('.pin-sticky').offsetHeight;
    scrollTo({ top: pin.getBoundingClientRect().top + scrollY + travel * 0.75, behavior: 'instant' });
  });
  setMode();
}

/* ---------- scroll progress + scroll-linked 3D rise ---------- */
function initScrollFx() {
  const bar = document.querySelector('.scroll-progress span');
  const rises = [...document.querySelectorAll('[data-rise3d]')];
  let raf = 0;
  const update = () => {
    raf = 0;
    const max = document.documentElement.scrollHeight - innerHeight;
    if (bar) bar.style.transform = `scaleX(${max > 0 ? clamp01(scrollY / max).toFixed(4) : 0})`;
    if (!reduced) rises.forEach(el => {
      const r = el.getBoundingClientRect();
      const t = smooth(clamp01((innerHeight - r.top) / (innerHeight * 0.75)));
      el.style.transform = t >= 1 ? '' : `translate3d(0, ${(60 * (1 - t)).toFixed(1)}px, 0) rotateX(${(22 * (1 - t)).toFixed(2)}deg) scale(${(0.9 + 0.1 * t).toFixed(4)})`;
    });
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(update); };
  addEventListener('scroll', kick, { passive: true }); addEventListener('resize', kick); update();
}

if (reduced) document.querySelectorAll('.film-video').forEach(v => { v.removeAttribute('autoplay'); v.pause(); });
document.querySelectorAll('[data-studio]').forEach(initStudio);
initPin();
initScrollFx();
initTilt();
initHeroDepth();
