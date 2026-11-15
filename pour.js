// Scroll-driven "tear. pour. stir." animation. Pure canvas, no libraries.
// Everything is a function of scroll progress (0..1), so scrolling back plays it in reverse.
const section = document.querySelector('[data-pour]');
if (section) init(section);

function init(section) {
  const canvas = section.querySelector('.pour-canvas');
  const ctx = canvas.getContext('2d');
  const steps = [...section.querySelectorAll('.pour-steps li')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ROOT = new URL('./', import.meta.url).href;

  const FLAVORS = {
    matcha: { liquid: [150, 172, 104], powder: [118, 146, 72], dust: [182, 199, 140] },
    acai:   { liquid: [140, 58, 92],   powder: [104, 30, 62],  dust: [196, 120, 150] },
    coffee: { liquid: [186, 138, 92],  powder: [96, 64, 40],   dust: [170, 128, 88] },
  };
  const MILK = [249, 245, 236];
  const imgs = {};
  for (const k of Object.keys(FLAVORS)) { const im = new Image(); im.src = `${ROOT}assets/stick-${k}.webp`; im.decode?.().catch(() => {}); imgs[k] = im; }
  let flavor = 'matcha';

  section.querySelectorAll('[data-pour-flavor]').forEach(b => b.addEventListener('click', () => {
    flavor = b.dataset.pourFlavor;
    section.querySelectorAll('[data-pour-flavor]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    section.style.setProperty('--pour-accent', `rgb(${FLAVORS[flavor].liquid.join(',')})`);
    section.dataset.flavor = flavor;
    if (centered) document.documentElement.dataset.flavor = flavor;
    draw();
  }));
  // page color follows the flavor on screen while this section sits across the middle of the viewport
  let centered = false;
  section.dataset.flavor = flavor;
  new IntersectionObserver(([e]) => {
    centered = e.isIntersecting;
    const root = document.documentElement;
    if (centered) root.dataset.flavor = flavor;
    else if (root.dataset.flavor === flavor) delete root.dataset.flavor;
  }, { rootMargin: '-50% 0px -50% 0px' }).observe(section);

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const mix = (c1, c2, t) => c1.map((v, i) => Math.round(lerp(v, c2[i], t)));
  const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  // deterministic pseudo-random per particle
  const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  let W = 0, H = 0, dpr = 1;
  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    draw();
  }

  function progress() {
    if (reduced) return 1;
    const r = section.getBoundingClientRect();
    const total = r.height - innerHeight;
    return total > 0 ? clamp(-r.top / total) : 1;
  }

  const TEAR = 0.1; // fraction of the stick that tears off (the crimp)
  function drawStick(img, ox, oy, angle, sh, partTop, partBottom, alpha = 1) {
    if (!img.complete || !img.naturalWidth) return;
    const sw = sh * img.naturalWidth / img.naturalHeight;
    const sy = img.naturalHeight * partTop, sHgt = img.naturalHeight * (partBottom - partTop);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(ox, oy); ctx.rotate(angle);
    ctx.shadowColor = 'rgba(40,30,20,.18)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 12;
    ctx.drawImage(img, 0, sy, img.naturalWidth, sHgt, -sw / 2, 0, sw, sh * (partBottom - partTop));
    ctx.restore();
  }

  // condensation droplets, fixed per glass so they never flicker
  const DROPS = Array.from({ length: 46 }, (_, i) => ({ u: rnd(i + 200), v: rnd(i + 300), r: 0.6 + rnd(i + 400) * 1.9 }));

  function draw(time = performance.now()) {
    if (!W) return;
    const p = progress();
    const F = FLAVORS[flavor];
    const t = time / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';

    // ---- layout ----
    const S = Math.min(W, H * 0.9);
    const narrow = W < 600;
    const cx = W * (narrow ? 0.6 : 0.56), base = H * (narrow ? 0.82 : 0.88);
    const gh = S * 0.46, gwTop = S * 0.32, gwBot = S * 0.25;
    const top = base - gh;
    const glassBase = S * 0.035;               // thick glass bottom
    const inner = base - glassBase;            // inside floor
    const level = top + gh * 0.3;              // liquid surface
    const sh = S * 0.5;                        // stick height
    const rimRy = gwTop * 0.075;               // perspective of the rim
    const halfAt = y => lerp(gwTop, gwBot, clamp((y - top) / gh)) / 2;

    // step highlight
    const step = p < 0.3 ? 0 : p < 0.64 ? 1 : 2;
    steps.forEach((li, i) => li.classList.toggle('is-active', i === step));
    section.dataset.step = String(step + 1);

    // ---- soft contact shadow (same light as the stick photo: from upper left) ----
    ctx.save();
    ctx.filter = `blur(${Math.round(S * 0.018)}px)`;
    ctx.fillStyle = 'rgba(70,52,34,.16)';
    ctx.beginPath(); ctx.ellipse(cx + S * 0.03, base + 2, gwBot * 0.62, S * 0.022, 0, 0, Math.PI * 2); ctx.fill();
    ctx.filter = 'none';
    ctx.fillStyle = 'rgba(60,44,28,.20)';
    ctx.beginPath(); ctx.ellipse(cx, base, gwBot * 0.5, S * 0.008, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // glass outline (outer wall)
    const glass = () => {
      const r = S * 0.03;
      ctx.beginPath();
      ctx.moveTo(cx - gwTop / 2, top);
      ctx.lineTo(cx - gwBot / 2, base - r);
      ctx.quadraticCurveTo(cx - gwBot / 2, base, cx - gwBot / 2 + r, base);
      ctx.lineTo(cx + gwBot / 2 - r, base);
      ctx.quadraticCurveTo(cx + gwBot / 2, base, cx + gwBot / 2, base - r);
      ctx.lineTo(cx + gwTop / 2, top);
      ctx.ellipse(cx, top, gwTop / 2, rimRy, 0, 0, Math.PI, true);
      ctx.closePath();
    };
    // liquid volume (inside the walls, above the thick base)
    const wall = S * 0.006;
    const liquidPath = () => {
      ctx.beginPath();
      ctx.moveTo(cx - halfAt(level) + wall, level);
      ctx.lineTo(cx - halfAt(inner) + wall, inner);
      ctx.ellipse(cx, inner, halfAt(inner) - wall, rimRy * 0.75, 0, Math.PI, 0, true);
      ctx.lineTo(cx + halfAt(level) - wall, level);
      ctx.closePath();
    };

    // ---- liquid ----
    const poured = ease(seg(p, 0.38, 0.62));
    const stir = seg(p, 0.64, 0.95);
    const colorMix = clamp(poured * 0.25 + ease(stir) * 0.75);
    const liquid = mix(MILK, F.liquid, colorMix);
    ctx.save(); liquidPath(); ctx.clip();
    const lg = ctx.createLinearGradient(0, level, 0, inner);
    lg.addColorStop(0, rgba(mix(liquid, [255, 255, 255], 0.16), 0.97));
    lg.addColorStop(1, rgba(mix(liquid, [40, 25, 15], 0.12), 0.99));
    ctx.fillStyle = lg;
    ctx.fillRect(cx - gwTop, level, gwTop * 2, gh);
    // cylindrical volume: darker toward both walls
    const vg = ctx.createLinearGradient(cx - gwTop / 2, 0, cx + gwTop / 2, 0);
    vg.addColorStop(0, 'rgba(40,28,16,.16)'); vg.addColorStop(0.22, 'rgba(40,28,16,0)');
    vg.addColorStop(0.72, 'rgba(40,28,16,0)'); vg.addColorStop(1, 'rgba(40,28,16,.22)');
    ctx.fillStyle = vg; ctx.fillRect(cx - gwTop, level, gwTop * 2, gh);

    // powder cloud sinking before stirring
    if (poured > 0 && colorMix < 1) {
      const cloudA = poured * (1 - ease(stir));
      for (let i = 0; i < 9; i++) {
        const bx = cx + (rnd(i + 50) - 0.5) * gwBot * 0.7 + Math.sin(t * 0.6 + i) * 3;
        const by = level + 10 + rnd(i + 80) * (inner - level) * 0.7 * poured;
        const br = gwBot * (0.16 + rnd(i + 20) * 0.2) * (0.5 + poured);
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        g.addColorStop(0, rgba(F.powder, 0.5 * cloudA));
        g.addColorStop(0.6, rgba(F.powder, 0.18 * cloudA));
        g.addColorStop(1, rgba(F.powder, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
      }
    }
    // marbled swirl while stirring (soft ribbons, not strokes)
    if (stir > 0 && stir < 1) {
      const a = Math.sin(stir * Math.PI);
      const rot = stir * 7 + t * 0.4;
      ctx.lineCap = 'round';
      ctx.filter = `blur(${Math.max(2, Math.round(S * 0.008))}px)`;
      for (let i = 0; i < 6; i++) {
        const yy = level + 14 + i * (inner - level - 24) / 6;
        const rx = (halfAt(yy) - wall) * (0.82 - i * 0.05);
        ctx.strokeStyle = rgba(i % 2 ? F.powder : MILK, 0.32 * a);
        ctx.lineWidth = S * (0.012 + i * 0.003);
        ctx.beginPath();
        ctx.ellipse(cx, yy, rx, rimRy * (0.7 + i * 0.12), 0, rot + i * 0.9, rot + i * 0.9 + Math.PI * 1.15);
        ctx.stroke();
      }
      ctx.filter = 'none';
    }
    // bubbles once mixed
    if (colorMix > 0.6) {
      for (let i = 0; i < 14; i++) {
        const life = (t * 0.1 + rnd(i)) % 1;
        const bx = cx + (rnd(i + 9) - 0.5) * gwBot * 0.8;
        const by = lerp(inner - 8, level + 8, life);
        ctx.fillStyle = `rgba(255,255,255,${0.3 * (1 - life) * (colorMix - 0.6) * 2.5})`;
        ctx.beginPath(); ctx.arc(bx, by, 1 + rnd(i + 3) * 2, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();

    // meniscus: lit surface with a darker back edge
    const surfR = halfAt(level) - wall;
    const sg = ctx.createLinearGradient(0, level - rimRy, 0, level + rimRy);
    sg.addColorStop(0, rgba(mix(liquid, [40, 28, 16], 0.10), 0.95));
    sg.addColorStop(1, rgba(mix(liquid, [255, 255, 255], 0.30), 0.95));
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.ellipse(cx, level, surfR, rimRy, 0, 0, Math.PI * 2); ctx.fill();

    // ---- ice: translucent cubes with lit top faces, partly submerged ----
    for (let i = 0; i < 3; i++) {
      const ix = cx + (i - 1) * gwTop * 0.22 + Math.sin(t * 0.7 + i * 2) * 2;
      const iy = level - S * 0.004 + Math.sin(t * 1.1 + i) * 2 + (i % 2) * S * 0.012;
      const s = gwTop * 0.17;
      ctx.save(); ctx.translate(ix, iy); ctx.rotate(0.28 * (i - 1) + Math.sin(t * 0.8 + i) * 0.04);
      const ig = ctx.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
      ig.addColorStop(0, 'rgba(255,255,255,.85)'); ig.addColorStop(0.5, 'rgba(255,255,255,.35)'); ig.addColorStop(1, 'rgba(225,232,236,.55)');
      ctx.fillStyle = ig;
      ctx.beginPath(); ctx.roundRect(-s / 2, -s / 2, s, s, s * 0.2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = Math.max(1, S * 0.002);
      ctx.beginPath(); ctx.moveTo(-s / 2 + s * 0.2, -s / 2 + 1); ctx.lineTo(s / 2 - s * 0.2, -s / 2 + 1); ctx.stroke();
      // submerged half takes the drink color
      ctx.fillStyle = rgba(liquid, 0.45);
      ctx.beginPath(); ctx.rect(-s / 2, s * 0.05, s, s / 2); ctx.fill();
      ctx.restore();
    }

    // ---- glass walls: thin, refractive edges, real highlights ----
    ctx.save(); glass(); ctx.clip();
    const wg = ctx.createLinearGradient(cx - gwTop / 2, 0, cx + gwTop / 2, 0);
    wg.addColorStop(0, 'rgba(120,105,85,.20)');
    wg.addColorStop(0.06, 'rgba(255,255,255,.10)');
    wg.addColorStop(0.14, 'rgba(255,255,255,.55)');
    wg.addColorStop(0.2, 'rgba(255,255,255,.08)');
    wg.addColorStop(0.8, 'rgba(255,255,255,.04)');
    wg.addColorStop(0.9, 'rgba(255,255,255,.28)');
    wg.addColorStop(1, 'rgba(120,105,85,.24)');
    ctx.fillStyle = wg; ctx.fillRect(cx - gwTop, top - rimRy, gwTop * 2, gh + rimRy * 2);
    // thick glass base
    const bg = ctx.createLinearGradient(0, inner, 0, base);
    bg.addColorStop(0, 'rgba(255,255,255,.55)'); bg.addColorStop(0.5, 'rgba(205,210,205,.45)'); bg.addColorStop(1, 'rgba(150,140,120,.35)');
    ctx.fillStyle = bg; ctx.fillRect(cx - gwBot, inner, gwBot * 2, glassBase + 2);
    // condensation below the liquid line
    for (const d of DROPS) {
      const y = lerp(level + 6, inner - 6, d.v);
      const x = cx + (d.u - 0.5) * 2 * (halfAt(y) - 4);
      const r = d.r * S / 700;
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // outer edge: a fine dark line outside, bright line inside
    ctx.save(); glass();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(95,80,60,.28)'; ctx.lineWidth = Math.max(1.2, S * 0.0035); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = Math.max(0.8, S * 0.0015); ctx.stroke();
    ctx.restore();
    // rim: back edge faint, front edge bright
    ctx.lineWidth = Math.max(1, S * 0.003);
    ctx.strokeStyle = 'rgba(95,80,60,.22)';
    ctx.beginPath(); ctx.ellipse(cx, top, gwTop / 2, rimRy, 0, Math.PI, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.95)';
    ctx.beginPath(); ctx.ellipse(cx, top, gwTop / 2, rimRy, 0, 0, Math.PI); ctx.stroke();

    // ---- stick ----
    const img = imgs[flavor];
    const enter = ease(seg(p, 0.0, 0.14));
    const tear = seg(p, 0.15, 0.3);
    const tilt = ease(seg(p, 0.3, 0.42));
    const leave = ease(seg(p, 0.6, 0.7));
    const restX = cx - gwTop * 1.15, restY = H * 0.12;
    const pourX = cx + gwTop * 0.05, pourY = top - S * 0.12;
    let ox = lerp(restX, pourX, tilt), oy = lerp(restY - (1 - enter) * H * 0.7, pourY, tilt);
    let ang = lerp(lerp(-0.5, -0.12, enter), 2.6, tilt);
    ox += leave * W * 0.5; oy -= leave * H * 0.3; ang += leave * 0.6;
    const stickAlpha = 1 - leave;
    if (stickAlpha > 0.01 && img.complete && img.naturalWidth) {
      drawStick(img, ox, oy, ang, sh, TEAR, 1, stickAlpha);
      // the top strip peels on a hinge at one corner, then drops away
      if (tear < 1) {
        const sw = sh * img.naturalWidth / img.naturalHeight;
        const peel = ease(seg(tear, 0, 0.55));       // hinge open
        const drop = ease(seg(tear, 0.55, 1));       // fall and fade
        ctx.save(); ctx.translate(ox, oy); ctx.rotate(ang);
        ctx.translate(sw / 2, 0);                      // hinge at the right corner of the tear line
        ctx.rotate(peel * 0.62 + drop * 0.5);
        ctx.translate(-sw / 2 + drop * S * 0.04, drop * drop * S * 0.32);
        drawStick(img, 0, -sh * TEAR, 0, sh, 0, TEAR, (1 - drop) * stickAlpha);
        ctx.restore();
        // a few flecks escape as it opens
        if (peel > 0.1 && drop < 1) {
          for (let i = 0; i < 10; i++) {
            const k = clamp(peel * 1.4 - rnd(i + 60) * 0.4);
            const fx = ox + Math.cos(ang) * (rnd(i) - 0.5) * sw + k * (rnd(i + 3) - 0.3) * S * 0.05;
            const fy = oy + Math.sin(ang) * (rnd(i) - 0.5) * sw - k * S * 0.03 + k * k * S * 0.06;
            ctx.fillStyle = rgba(F.dust, 0.8 * (1 - drop));
            ctx.beginPath(); ctx.arc(fx, fy, 0.8 + rnd(i + 5) * 1.4, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
    }

    // ---- powder stream ----
    if (p > 0.36 && p < 0.61) {
      const N = 320;
      for (let i = 0; i < N; i++) {
        const t0 = 0.37 + (i / N) * 0.17;
        const u = (p - t0) / 0.07;
        if (u <= 0 || u >= 1) continue;
        const spread = (rnd(i) - 0.5);
        const x = lerp(ox + spread * 10, cx + spread * gwTop * 0.35, u) + Math.sin(t * 6 + i) * 1.2;
        const y = lerp(oy + 6, level, u * u);
        const r = (0.9 + rnd(i + 7) * 2.2) * S / 600;
        ctx.fillStyle = rgba(rnd(i + 2) > 0.7 ? F.dust : F.powder, 0.85);
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      const puff = Math.sin(seg(p, 0.38, 0.61) * Math.PI);
      const g = ctx.createRadialGradient(cx, level - 4, 0, cx, level - 4, gwTop * 0.5);
      g.addColorStop(0, rgba(F.dust, 0.3 * puff)); g.addColorStop(1, rgba(F.dust, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, level - 4, gwTop * 0.5, 0, Math.PI * 2); ctx.fill();
    }

    // ---- bar spoon while stirring: brushed steel, twisted stem, small bowl ----
    if (stir > 0 && stir < 1) {
      const a = Math.min(1, Math.sin(stir * Math.PI) * 2.2);
      const sa = stir * 7 + t * 0.4;
      const bx = cx + Math.cos(sa) * gwBot * 0.2, by = level + (inner - level) * 0.55 + Math.sin(sa) * rimRy * 0.6;
      const hx = bx + gwTop * 0.38, hy = top - S * 0.26;
      const len = Math.hypot(hx - bx, hy - by), ang2 = Math.atan2(hy - by, hx - bx);
      const sw2 = Math.max(2.5, S * 0.006);
      const spoon = fill => {
        ctx.save(); ctx.translate(bx, by); ctx.rotate(ang2);
        ctx.fillStyle = fill;
        ctx.beginPath(); ctx.roundRect(0, -sw2 / 2, len, sw2, sw2 / 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-S * 0.012, 0, S * 0.018, S * 0.009, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(len, 0, sw2 * 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      };
      ctx.save(); ctx.globalAlpha = a;
      // steel: gradient across the stem, twist marks along it
      ctx.save(); ctx.translate(bx, by); ctx.rotate(ang2);
      const mg = ctx.createLinearGradient(0, -sw2, 0, sw2);
      mg.addColorStop(0, '#f6f4f0'); mg.addColorStop(0.5, '#a7a39a'); mg.addColorStop(1, '#dcd9d2');
      ctx.restore();
      spoon(mg);
      ctx.save(); ctx.translate(bx, by); ctx.rotate(ang2);
      ctx.strokeStyle = 'rgba(120,115,105,.35)'; ctx.lineWidth = 0.8;
      for (let x = len * 0.25; x < len * 0.8; x += sw2 * 1.6) { ctx.beginPath(); ctx.moveTo(x, -sw2 / 2); ctx.lineTo(x + sw2, sw2 / 2); ctx.stroke(); }
      ctx.restore();
      // under the surface the steel takes on the drink color
      liquidPath(); ctx.clip();
      spoon(rgba(liquid, 0.6));
      ctx.restore();
    }
  }

  let raf = 0, visible = false;
  const loop = time => { draw(time); raf = visible ? requestAnimationFrame(loop) : 0; };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(loop); }, { rootMargin: '100px' }).observe(section);
  addEventListener('resize', resize);
  Object.values(imgs).forEach(im => im.addEventListener('load', () => draw()));
  if (reduced) section.classList.add('pour-static');
  resize();
}
