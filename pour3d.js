// tear. pour. stir. in three.js: a real glass (physical transmission), ice, milk, the stick, a bar spoon.
// Every frame is a pure function of scroll progress (plus a tiny idle drift), so scrolling back plays it in reverse.
import * as THREE from './vendor/three.module.js';
import { FLAVORS as STICK, makePacket, BODY_H, CAP_H } from './packets3d.js?v=20261115b';
import { RoomEnvironment } from './vendor/three-addons/environments/RoomEnvironment.js';

const section = document.querySelector('[data-pour]');
if (section) init(section);

function init(section) {
  const canvas = section.querySelector('.pour-canvas');
  const steps = [...section.querySelectorAll('.pour-steps li')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  const DRINK = {
    matcha: { liquid: '#9cb36a', powder: '#7e9a4c', dust: '#b8c98c' },
    acai:   { liquid: '#7a2c52', powder: '#5e1f42', dust: '#c37a9a' },
    coffee: { liquid: '#b88c62', powder: '#5a3c26', dust: '#a88058' },
  };
  const MILK = new THREE.Color('#f4efe4');

  const scene = new THREE.Scene();
  const bg = new THREE.Color('#efe8dc'); scene.background = bg;
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(renderer), 0.03).texture;
  scene.add(new THREE.HemisphereLight('#fff8ec', '#cdbb9c', 0.7));
  const key = new THREE.DirectionalLight('#fff4e2', 1.7); key.position.set(-3, 6, 4); scene.add(key);
  const rim = new THREE.DirectionalLight('#ffffff', 0.9); rim.position.set(3, 3, -4); scene.add(rim);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 60);

  /* ---------- the glass: a lathed tumbler with a thick base ---------- */
  const H = 2.3, R0 = 0.6, R1 = 0.78, WALL = 0.045, BASE = 0.2;
  const glassProfile = [
    [0, 0], [R0 - 0.06, 0], [R0, 0.05], [R1, H - 0.02], [R1 - 0.012, H], [R1 - WALL, H - 0.01],
    [R0 - WALL, BASE + 0.04], [R0 - WALL - 0.05, BASE], [0, BASE],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  // glass: clear, with real reflections; drawn back faces first, then front faces, so both walls read
  // (alpha blending instead of transmission, so it renders the same on every phone)
  const glassGeo = new THREE.LatheGeometry(glassProfile, 96);
  const glassMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.02, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02,
    transparent: true, opacity: 0.16, envMapIntensity: 2.2, depthWrite: false, side: THREE.FrontSide });
  const glassBack = new THREE.Mesh(glassGeo, glassMat.clone()); glassBack.material.side = THREE.BackSide; glassBack.material.opacity = 0.1; glassBack.renderOrder = 1;
  const glassFront = new THREE.Mesh(glassGeo, glassMat); glassFront.renderOrder = 4;
  const glass = new THREE.Group(); glass.add(glassBack, glassFront);
  // a crisp rim and a thick base read as glass more than anything else
  const rimRing = new THREE.Mesh(new THREE.TorusGeometry(R1 - 0.02, 0.012, 12, 128), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.55, envMapIntensity: 2 }));
  rimRing.rotation.x = Math.PI / 2; rimRing.position.y = H - 0.005; rimRing.renderOrder = 5; glass.add(rimRing);
  const baseSlab = new THREE.Mesh(new THREE.CylinderGeometry(R0 - 0.01, R0 - 0.03, BASE - 0.01, 96), new THREE.MeshPhysicalMaterial({ color: '#e9f1ee', roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.45, envMapIntensity: 2, depthWrite: false }));
  baseSlab.position.y = BASE / 2; baseSlab.renderOrder = 3; glass.add(baseSlab);
  scene.add(glass);

  /* ---------- the drink inside ---------- */
  const LEVEL = 1.5;
  const innerR = y => lerp(R0 - WALL, R1 - WALL, y / H) - 0.004;
  const liquidGeo = new THREE.LatheGeometry([
    new THREE.Vector2(0, BASE + 0.002), new THREE.Vector2(innerR(BASE) - 0.04, BASE + 0.002), new THREE.Vector2(innerR(BASE + 0.05), BASE + 0.05),
    new THREE.Vector2(innerR(LEVEL), LEVEL), new THREE.Vector2(0, LEVEL),
  ], 96);
  const liquidMat = new THREE.MeshPhysicalMaterial({ color: MILK.clone(), roughness: 0.25, clearcoat: 0.7, clearcoatRoughness: 0.15 });
  const liquid = new THREE.Mesh(liquidGeo, liquidMat); liquid.renderOrder = 2;
  scene.add(liquid);

  // swirl on the surface while stirring: a spiral texture that rotates and fades
  const swirlTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
    g.translate(256, 256);
    for (let arm = 0; arm < 3; arm++) {
      g.rotate((Math.PI * 2) / 3);
      g.beginPath();
      for (let a = 0; a < Math.PI * 3.2; a += 0.04) { const r = 20 + a * 24; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 26; g.lineCap = 'round'; g.filter = 'blur(10px)'; g.stroke();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const swirl = new THREE.Mesh(new THREE.CircleGeometry(innerR(LEVEL) - 0.01, 64), new THREE.MeshBasicMaterial({ map: swirlTex, transparent: true, depthWrite: false, opacity: 0, color: '#ffffff' }));
  swirl.rotation.x = -Math.PI / 2; swirl.position.y = LEVEL + 0.003; scene.add(swirl);

  // powder: a cloud of fine particles that blooms through the milk and is stirred in
  const dot = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const NCLOUD = 900, cloudPos = new Float32Array(NCLOUD * 3);
  const cloud = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 0.11, map: dot, transparent: true, depthWrite: false, opacity: 0, color: '#7e9a4c' }));
  cloud.geometry.setAttribute('position', new THREE.BufferAttribute(cloudPos, 3)); scene.add(cloud);
  cloud.material.depthTest = false; cloud.renderOrder = 2.5;   // the bloom shows through the milk
  // the falling stream
  const NSTREAM = 500, streamPos = new Float32Array(NSTREAM * 3);
  const stream = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 0.055, map: dot, transparent: true, depthWrite: false, color: '#7e9a4c' }));
  stream.geometry.setAttribute('position', new THREE.BufferAttribute(streamPos, 3)); scene.add(stream);

  /* ---------- ice: rounded cubes of clear ice ---------- */
  function roundedCube(size, r) {
    const g = new THREE.BoxGeometry(size, size, size, 8, 8, 8), p = g.attributes.position, v = new THREE.Vector3(), q = new THREE.Vector3(), h = size / 2 - r;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      q.set(clamp(v.x, -h, h), clamp(v.y, -h, h), clamp(v.z, -h, h));
      v.sub(q).normalize().multiplyScalar(r).add(q);
      v.multiplyScalar(1 + (Math.sin(v.x * 23) * Math.sin(v.y * 19) * Math.sin(v.z * 17)) * 0.02);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals(); return g;
  }
  const iceMat = new THREE.MeshPhysicalMaterial({ color: '#f4fbff', roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08, transparent: true, opacity: 0.62, envMapIntensity: 2, depthWrite: false });
  const ices = [0, 1, 2].map(i => { const m = new THREE.Mesh(roundedCube(0.42 - i * 0.04, 0.07), iceMat); m.userData.phase = i * 2.1; m.renderOrder = 3; scene.add(m); return m; });

  /* ---------- bar spoon: brushed steel, twisted stem, small bowl ---------- */
  const steel = new THREE.MeshPhysicalMaterial({ color: '#d9d6cf', metalness: 1, roughness: 0.22, clearcoat: 0.4 });
  const spoon = new THREE.Group();
  {
    const LEN = 3.2;
    const stemCurve = new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, LEN, 0));
    const stem = new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 64, 0.022, 8), steel);
    // twist: wrap a fine helix around the stem
    const helixPts = []; for (let i = 0; i <= 200; i++) { const t = i / 200; helixPts.push(new THREE.Vector3(Math.cos(t * 60) * 0.022, 0.4 + t * (LEN - 0.9), Math.sin(t * 60) * 0.022)); }
    const helix = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helixPts), 400, 0.009, 6), steel);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), steel);
    bowl.scale.set(1, 0.35, 1.5); bowl.rotation.x = Math.PI;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 16), steel); knob.position.y = LEN;
    spoon.add(stem, helix, bowl, knob);
  }
  scene.add(spoon);

  /* ---------- the stick ---------- */
  const world = new THREE.Group(); scene.add(world);
  let flavor = 'matcha', stick = null;
  function setStick(k) {
    if (stick) world.remove(stick);
    stick = makePacket(k); stick.scale.setScalar(0.62); world.add(stick);
  }
  setStick(flavor);

  /* ---------- soft shadow ---------- */
  const shadow = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(80,60,40,.38)'); r.addColorStop(1, 'rgba(80,60,40,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(0.18, 0.002, 0.1); return m;
  })();
  scene.add(shadow);
  world.add(glass, liquid, swirl, cloud, stream, ...ices, spoon, shadow);

  /* ---------- flavor buttons ---------- */
  section.querySelectorAll('[data-pour-flavor]').forEach(b => b.addEventListener('click', () => {
    flavor = b.dataset.pourFlavor;
    section.querySelectorAll('[data-pour-flavor]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    section.style.setProperty('--pour-accent', DRINK[flavor].liquid);
    section.dataset.flavor = flavor;
    if (centered) document.documentElement.dataset.flavor = flavor;
    setStick(flavor); draw();
  }));
  let centered = false;
  section.dataset.flavor = flavor;
  new IntersectionObserver(([e]) => {
    centered = e.isIntersecting;
    const root = document.documentElement;
    if (centered) root.dataset.flavor = flavor;
    else if (root.dataset.flavor === flavor) delete root.dataset.flavor;
  }, { rootMargin: '-50% 0px -50% 0px' }).observe(section);

  /* ---------- layout ---------- */
  let W = 0, Hpx = 0, narrow = false;
  function resize() {
    const r = canvas.getBoundingClientRect(); W = r.width; Hpx = r.height; narrow = W < 600;
    renderer.setSize(W, Hpx, false);
    camera.aspect = W / Math.max(1, Hpx);
    camera.position.set(0, 2.5, narrow ? 9.4 : 7.4); camera.lookAt(0, 1.55, 0);
    camera.updateProjectionMatrix(); draw();
  }
  function progress() {
    if (reduced) return 1;
    const r = section.getBoundingClientRect();
    const total = r.height - innerHeight;
    return total > 0 ? clamp(-r.top / total) : 1;
  }
  const parseBg = () => { const m = getComputedStyle(section).backgroundColor.match(/\d+(\.\d+)?/g); if (m) bg.setRGB(m[0] / 255, m[1] / 255, m[2] / 255, THREE.SRGBColorSpace); };

  const powder = new THREE.Color(), liquidCol = new THREE.Color(), tmp = new THREE.Vector3();
  let lastDraw = 0;
  function draw(time = performance.now()) {
    if (!W) return;
    lastDraw = performance.now();
    parseBg();
    const p = progress(), t = reduced ? 0 : time / 1000;
    const D = DRINK[flavor];
    const step = p < 0.3 ? 0 : p < 0.64 ? 1 : 2;
    steps.forEach((li, i) => li.classList.toggle('is-active', i === step));

    const enter = smooth(seg(p, 0.0, 0.12));
    const tear = seg(p, 0.13, 0.28);
    const tilt = smooth(seg(p, 0.3, 0.42));
    const poured = smooth(seg(p, 0.4, 0.6));
    const leave = smooth(seg(p, 0.58, 0.68));
    const stir = seg(p, 0.66, 0.96);
    const mixed = smooth(seg(p, 0.66, 0.9));

    // liquid color: milk, a little tint as powder lands, the full flavor once stirred
    powder.set(D.powder);
    liquidCol.copy(MILK).lerp(new THREE.Color(D.liquid), clamp(poured * 0.25 + mixed * 0.75));
    liquidMat.color.copy(liquidCol);

    // stick: drops in beside the glass, cap tears off on a hinge, tilts over the rim, pours, leaves
    const sh = (BODY_H / 2 + CAP_H) * 0.62;
    const rest = new THREE.Vector3(-1.45, 2.0 + (1 - enter) * 3, 0.2);
    const over = new THREE.Vector3(-0.3, H + 0.85, 0.1);
    stick.position.lerpVectors(rest, over, tilt);
    stick.position.x += leave * 2.2; stick.position.y += leave * 2.4;
    stick.rotation.set(0, lerp(0.35, 0.1, tilt), lerp(lerp(0.25, 0.08, enter), -2.35, tilt) + leave * -0.6);
    const cap = stick.userData.cap;
    const peel = smooth(seg(tear, 0, 0.5)), drop = smooth(seg(tear, 0.5, 1));
    cap.position.copy(cap.userData.home);
    cap.rotation.set(0, 0, -peel * 0.9 - drop * 0.6);
    cap.position.x += peel * 0.18 + drop * 0.5; cap.position.y += peel * 0.05 - drop * drop * 3.5;
    cap.visible = drop < 0.98;
    stick.visible = leave < 0.99;

    // the opening of the stick in world space (top of the body)
    stick.updateMatrix();
    const mouth = tmp.set(0, BODY_H / 2, 0).applyMatrix4(stick.matrix);   // in the glass's own frame

    // powder stream from the mouth into the glass
    const streamOn = p > 0.38 && p < 0.62;
    stream.visible = streamOn;
    stream.material.color.copy(powder);
    if (streamOn) {
      for (let i = 0; i < NSTREAM; i++) {
        const t0 = 0.39 + (i / NSTREAM) * 0.17, u = (p - t0) / 0.06;
        if (u <= 0 || u >= 1) { streamPos[i * 3 + 1] = -99; continue; }
        const spread = (rnd(i) - 0.5) * 0.12, jit = (rnd(i + 7) - 0.5) * 0.06;
        streamPos[i * 3] = lerp(mouth.x + spread * 0.3, spread * 1.6, u) + Math.sin(t * 6 + i) * 0.01;
        streamPos[i * 3 + 1] = lerp(mouth.y, LEVEL + 0.02, u * u);
        streamPos[i * 3 + 2] = lerp(mouth.z, jit * 3, u);
      }
      stream.geometry.attributes.position.needsUpdate = true;
    }

    // cloud: blooms through the milk, then spirals and dissolves as it is stirred
    const bloom = poured * (1 - mixed);
    cloud.material.opacity = 0.85 * bloom;
    cloud.material.color.copy(powder);
    cloud.visible = bloom > 0.01;
    if (cloud.visible) {
      for (let i = 0; i < NCLOUD; i++) {
        const depth = rnd(i + 3), ang = rnd(i) * Math.PI * 2 + stir * 9 * (1 - depth * 0.5);
        const y = lerp(LEVEL - 0.05, LEVEL - 0.05 - (LEVEL - BASE - 0.1) * depth * (0.3 + poured * 0.7), 1);
        const rr = (innerR(y) - 0.05) * Math.sqrt(rnd(i + 1)) * lerp(0.35 + depth * 0.4, 1, stir);
        cloudPos[i * 3] = Math.cos(ang) * rr; cloudPos[i * 3 + 1] = y + Math.sin(t * 0.8 + i) * 0.01; cloudPos[i * 3 + 2] = Math.sin(ang) * rr;
      }
      cloud.geometry.attributes.position.needsUpdate = true;
    }
    swirl.material.opacity = 0.75 * Math.sin(stir * Math.PI);
    swirl.material.color.copy(powder).lerp(new THREE.Color('#ffffff'), 0.35);
    swirl.rotation.z = -stir * 14;

    // ice: floats at the surface, bobs, and is carried round the glass while stirring
    ices.forEach((ice, i) => {
      const a = ice.userData.phase + stir * 7 * (0.8 + i * 0.1) + Math.sin(t * 0.4 + i) * 0.05;
      const rr = 0.32 - i * 0.04;
      ice.position.set(Math.cos(a) * rr, LEVEL - 0.08 + Math.sin(t * 1.3 + i) * 0.015, Math.sin(a) * rr);
      ice.rotation.set(0.4 + i, a * 0.6 + i, 0.2 * i + Math.sin(t * 0.7 + i) * 0.05);
    });

    // spoon: dips in, sweeps circles round the glass, lifts out
    const sIn = smooth(seg(stir, 0, 0.12)), sOut = smooth(seg(stir, 0.86, 1));
    spoon.visible = stir > 0 && stir < 1;
    if (spoon.visible) {
      const a = stir * Math.PI * 2 * 4.5;
      const dip = lerp(H + 1.2, BASE + 0.25, sIn) + sOut * (H + 1);
      spoon.position.set(Math.cos(a) * 0.3, dip, Math.sin(a) * 0.3);
      spoon.rotation.set(Math.sin(a) * 0.18, 0, -0.16 - Math.cos(a) * 0.12);
    }

    // frame: glass sits right of the copy on desktop, centered on phones
    world.position.x = narrow ? 0.2 : 0.35;

    renderer.render(scene, camera);
  }

  let raf = 0, visible = false;
  const loop = time => { draw(time); raf = visible ? requestAnimationFrame(loop) : 0; };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(loop); }, { rootMargin: '100px' }).observe(section);
  addEventListener('resize', resize);
  addEventListener('scroll', () => { if (performance.now() - lastDraw > 60) draw(); }, { passive: true });
  if (reduced) section.classList.add('pour-static');
  resize();
}
