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
    draw();
  }));

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

  function draw(time = performance.now()) {
    if (!W) return;
    const p = progress();
    const F = FLAVORS[flavor];
    const t = time / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // ---- layout ----
    const S = Math.min(W, H * 0.9);
    const narrow = W < 600;
    const cx = W * (narrow ? 0.6 : 0.56), base = H * (narrow ? 0.8 : 0.88);
    const gh = S * 0.46, gwTop = S * 0.32, gwBot = S * 0.25;
    const top = base - gh;
    const level = top + gh * 0.3;            // liquid surface
    const sh = S * 0.5;                      // stick height

    // step highlight
    const step = p < 0.3 ? 0 : p < 0.64 ? 1 : 2;
    steps.forEach((li, i) => li.classList.toggle('is-active', i === step));

    // ---- glass shadow ----
    ctx.fillStyle = 'rgba(60,45,30,.12)';
    ctx.beginPath(); ctx.ellipse(cx, base + 6, gwBot * 0.62, 9, 0, 0, Math.PI * 2); ctx.fill();

    // glass interior path
    const glass = () => {
      ctx.beginPath();
      ctx.moveTo(cx - gwTop / 2, top);
      ctx.lineTo(cx - gwBot / 2, base - 14);
      ctx.quadraticCurveTo(cx - gwBot / 2, base, cx - gwBot / 2 + 14, base);
      ctx.lineTo(cx + gwBot / 2 - 14, base);
      ctx.quadraticCurveTo(cx + gwBot / 2, base, cx + gwBot / 2, base - 14);
      ctx.lineTo(cx + gwTop / 2, top);
      ctx.closePath();
    };
    const halfAt = y => lerp(gwTop, gwBot, (y - top) / gh) / 2;

    // ---- liquid ----
    const poured = ease(seg(p, 0.38, 0.62));
    const stir = seg(p, 0.64, 0.95);
    const colorMix = clamp(poured * 0.25 + ease(stir) * 0.75);
    const liquid = mix(MILK, F.liquid, colorMix);
    ctx.save(); glass(); ctx.clip();
    const lg = ctx.createLinearGradient(0, level, 0, base);
    lg.addColorStop(0, rgba(mix(liquid, [255, 255, 255], 0.12), 0.96));
    lg.addColorStop(1, rgba(mix(liquid, [0, 0, 0], 0.08), 0.98));
    ctx.fillStyle = lg;
    ctx.fillRect(cx - gwTop, level, gwTop * 2, gh);

    // powder cloud sinking before stirring
    if (poured > 0 && colorMix < 1) {
      const cloudA = poured * (1 - ease(stir));
      for (let i = 0; i < 7; i++) {
        const bx = cx + (rnd(i + 50) - 0.5) * gwBot * 0.7 + Math.sin(t * 0.8 + i) * 4;
        const by = level + 14 + rnd(i + 80) * gh * 0.45 * poured;
        const br = gwBot * (0.18 + rnd(i + 20) * 0.22) * (0.5 + poured);
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        g.addColorStop(0, rgba(F.powder, 0.55 * cloudA));
        g.addColorStop(1, rgba(F.powder, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
      }
    }
    // swirl while stirring
    if (stir > 0 && stir < 1) {
      const a = Math.sin(stir * Math.PI);
      const rot = stir * 8 + t * 0.5;
      ctx.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const yy = level + 18 + i * (base - level - 30) / 5;
        const rx = halfAt(yy) * (0.85 - i * 0.06);
        ctx.strokeStyle = rgba(i % 2 ? F.powder : MILK, 0.35 * a);
        ctx.lineWidth = 6 + i * 2;
        ctx.beginPath();
        ctx.ellipse(cx, yy, rx, 10 + i * 2, 0, rot + i, rot + i + Math.PI * 1.1);
        ctx.stroke();
      }
    }
    // ice cubes
    for (let i = 0; i < 3; i++) {
      const ix = cx + (i - 1) * gwTop * 0.24 + Math.sin(t * 0.9 + i * 2) * 3;
      const iy = level - 6 + Math.sin(t * 1.3 + i) * 3 + i % 2 * 10;
      const s = gwTop * 0.17;
      ctx.save(); ctx.translate(ix, iy); ctx.rotate(0.3 * (i - 1) + Math.sin(t + i) * 0.05);
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(-s / 2, -s / 2, s, s, s * 0.22); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    // bubbles once mixed
    if (colorMix > 0.6) {
      for (let i = 0; i < 14; i++) {
        const life = (t * 0.12 + rnd(i)) % 1;
        const bx = cx + (rnd(i + 9) - 0.5) * gwBot * 0.8;
        const by = lerp(base - 10, level + 8, life);
        ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - life) * (colorMix - 0.6) * 2.5})`;
        ctx.beginPath(); ctx.arc(bx, by, 1.5 + rnd(i + 3) * 2.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();

    // surface ellipse
    ctx.fillStyle = rgba(mix(liquid, [255, 255, 255], 0.25), 0.9);
    ctx.beginPath(); ctx.ellipse(cx, level, halfAt(level), 9, 0, 0, Math.PI * 2); ctx.fill();

    // glass body
    ctx.save(); glass();
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fill();
    ctx.strokeStyle = 'rgba(90,75,55,.22)'; ctx.lineWidth = 3.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
    ctx.beginPath(); ctx.ellipse(cx, top, gwTop / 2, 11, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(90,75,55,.22)'; ctx.lineWidth = 3.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 1.5; ctx.stroke();
    // highlight
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.beginPath();
    ctx.moveTo(cx - gwTop / 2 + 14, top + 16); ctx.lineTo(cx - gwBot / 2 + 12, base - 24);
    ctx.lineTo(cx - gwBot / 2 + 22, base - 24); ctx.lineTo(cx - gwTop / 2 + 26, top + 16); ctx.closePath(); ctx.fill();

    // ---- stick ----
    const img = imgs[flavor];
    const enter = ease(seg(p, 0.0, 0.14));
    const tear = ease(seg(p, 0.15, 0.28));
    const tilt = ease(seg(p, 0.3, 0.42));
    const leave = ease(seg(p, 0.6, 0.7));
    // opening point O and angle
    const restX = cx - gwTop * 1.15, restY = H * 0.12;
    const pourX = cx + gwTop * 0.05, pourY = top - S * 0.12;
    let ox = lerp(restX, pourX, tilt), oy = lerp(restY - (1 - enter) * H * 0.7, pourY, tilt);
    let ang = lerp(lerp(-0.5, -0.12, enter), 2.6, tilt);
    ox += leave * W * 0.5; oy -= leave * H * 0.3; ang += leave * 0.6;
    const stickAlpha = 1 - leave;
    if (stickAlpha > 0.01) {
      // body below the tear line; its top edge (the opening) sits at O
      drawStick(img, ox, oy, ang, sh, TEAR, 1, stickAlpha);
      // torn-off top flies away
      if (tear < 1) {
        ctx.save(); ctx.translate(ox, oy); ctx.rotate(ang);
        ctx.translate(tear * S * 0.42, -Math.sin(tear * Math.PI) * S * 0.16 + tear * tear * S * 0.2); ctx.rotate(tear * 2.2);
        drawStick(img, 0, -sh * TEAR - tear * 6, 0, sh, 0, TEAR, (1 - tear) * stickAlpha);
        ctx.restore();
      }
    }

    // ---- powder stream ----
    if (p > 0.36 && p < 0.66) {
      const N = 320;
      for (let i = 0; i < N; i++) {
        const t0 = 0.37 + (i / N) * 0.24;
        const u = (p - t0) / 0.07;
        if (u <= 0 || u >= 1) continue;
        const spread = (rnd(i) - 0.5);
        const x = lerp(ox + spread * 10, cx + spread * gwTop * 0.35, u) + Math.sin(t * 6 + i) * 1.2;
        const y = lerp(oy + 6, level, u * u);
        const r = 1.2 + rnd(i + 7) * 2.6;
        ctx.fillStyle = rgba(rnd(i + 2) > 0.7 ? F.dust : F.powder, 0.85);
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      // dust puff at the surface
      const puff = Math.sin(seg(p, 0.38, 0.64) * Math.PI);
      const g = ctx.createRadialGradient(cx, level - 4, 0, cx, level - 4, gwTop * 0.5);
      g.addColorStop(0, rgba(F.dust, 0.35 * puff)); g.addColorStop(1, rgba(F.dust, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, level - 4, gwTop * 0.5, 0, Math.PI * 2); ctx.fill();
    }

    // ---- spoon while stirring ----
    if (stir > 0 && stir < 1) {
      const a = Math.sin(stir * Math.PI);
      const sa = stir * 8 + t * 0.5;
      const sx = cx + Math.cos(sa) * gwBot * 0.22, sy = level + 30 + Math.sin(sa) * 6;
      ctx.save(); ctx.globalAlpha = Math.min(1, a * 2.2);
      ctx.strokeStyle = '#c9c4ba'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + gwTop * 0.35, top - S * 0.22); ctx.stroke();
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
