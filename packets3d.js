// Shared 3D drink-stick model: flavors, label textures, packet geometry.
import * as THREE from './vendor/three.module.js';

export const FLAVORS = {
  matcha: { name: 'matcha', note: 'earthy. green. unmistakably matcha.', pack: '#b3c485', ink: '#3a4a26', stage: '#e9dfcc', powder: '#86a35a', drink: '#9dbb72', drinkTop: '#c9d9a8' },
  acai:   { name: 'açaí',   note: 'berry-forward. a little different.',   pack: '#e6a5a4', ink: '#8a3f42', stage: '#ecdccc', powder: '#6e2d4a', drink: '#5b2340', drinkTop: '#8a4766' },
  coffee: { name: 'tiramisu coffee', note: 'coffee first. always.',               pack: '#dcb185', ink: '#6a3d1a', stage: '#eadbc6', powder: '#5c3f2a', drink: '#a57a55', drinkTop: '#d9bf9f' },
};
export const ORDER = ['matcha', 'acai', 'coffee'];

/* ---------- textures ---------- */
const NOTE = { matcha: 'with L-theanine', acai: '+ collagen', coffee: 'with citicoline' };
const NUM = { matcha: '01', acai: '02', coffee: '03' };
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const ch = s => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) + amt * 255)));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
function spaced(g, text, x, y, px) { try { g.letterSpacing = `${px}px`; } catch (e) {} g.fillText(text, x, y); try { g.letterSpacing = '0px'; } catch (e) {} }
function illustration(g, key, cx, cy, ink) {
  g.save(); g.translate(cx, cy); g.scale(1.45, 1.45); g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round';
  if (key === 'matcha') {
    const leaf = (rot, s) => { g.save(); g.rotate(rot); g.scale(s, s);
      g.beginPath(); g.moveTo(0, 60); g.bezierCurveTo(-48, 20, -40, -50, 0, -78); g.bezierCurveTo(40, -50, 48, 20, 0, 60); g.stroke();
      g.beginPath(); g.moveTo(0, 70); g.lineTo(0, -60); g.stroke();
      for (let i = 0; i < 3; i++) { const y = 30 - i * 26; g.beginPath(); g.moveTo(0, y); g.lineTo(-22 + i * 4, y - 20); g.moveTo(0, y); g.lineTo(22 - i * 4, y - 20); g.stroke(); }
      g.restore(); };
    g.translate(-26, 0); leaf(-0.38, 0.82); g.translate(52, 6); leaf(0.42, 0.92);
  } else if (key === 'acai') {
    [[-30, 10], [12, 18], [-8, -24], [34, -14], [-38, -34], [4, 52]].forEach(([x, y], i) => {
      g.beginPath(); g.arc(x, y, 21 - (i % 3) * 2, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(x - 6, y - 7, 3.5, 0, Math.PI * 2); g.fill();
    });
    g.beginPath(); g.moveTo(-8, -46); g.quadraticCurveTo(-4, -86, 30, -100); g.stroke();
  } else {
    const bean = (x, y, rot) => { g.save(); g.translate(x, y); g.rotate(rot);
      g.beginPath(); g.ellipse(0, 0, 30, 44, 0, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(0, -38); g.bezierCurveTo(-14, -12, 14, 12, 0, 38); g.stroke(); g.restore(); };
    bean(-30, 8, -0.5); bean(32, -10, 0.45);
  }
  g.restore();
}
export function labelTexture(f, back = false, key = 'matcha') {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 1792;
  const g = c.getContext('2d');
  // tonal base: lighter at the top, a touch deeper at the bottom
  const base = g.createLinearGradient(0, 0, 0, c.height);
  base.addColorStop(0, shade(f.pack, 0.015)); base.addColorStop(1, shade(f.pack, -0.015));
  g.fillStyle = base; g.fillRect(0, 0, c.width, c.height);
  // fine paper grain
  const img = g.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < img.data.length; i += 4) { const n = (Math.random() - 0.5) * 6; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
  g.putImageData(img, 0, 0);
  // soft-touch sheen
  const sh = g.createLinearGradient(0, 0, c.width, 0);
  sh.addColorStop(0, 'rgba(0,0,0,0.08)'); sh.addColorStop(0.3, 'rgba(255,255,255,0.12)');
  sh.addColorStop(0.62, 'rgba(255,255,255,0.03)'); sh.addColorStop(1, 'rgba(0,0,0,0.10)');
  g.fillStyle = sh; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = f.ink; g.strokeStyle = f.ink; g.textBaseline = 'middle'; g.textAlign = 'center';
  // hairline inset frame
  if (!back) {
    g.save(); g.translate(c.width / 2 + 6, 700); g.rotate(-Math.PI / 2);
    g.font = '700 200px DM, Arial, sans-serif'; spaced(g, 'normie.', 0, 0, -4); g.restore();
    let fs = 50; g.font = `400 ${fs}px DM, Arial, sans-serif`;
    while (fs > 28 && g.measureText(f.name).width > c.width * 0.8) { fs -= 2; g.font = `400 ${fs}px DM, Arial, sans-serif`; }
    g.globalAlpha = 0.9; g.fillText(f.name, c.width / 2, 1250);
    g.globalAlpha = 0.75; g.font = '400 34px DM, Arial, sans-serif';
    g.fillText('single', c.width / 2, 1390); g.fillText('serving', c.width / 2, 1432); g.globalAlpha = 1;
  } else {
    const seam = g.createLinearGradient(c.width / 2 - 26, 0, c.width / 2 + 26, 0);
    seam.addColorStop(0, 'rgba(0,0,0,0)'); seam.addColorStop(.42, 'rgba(0,0,0,.10)'); seam.addColorStop(.5, 'rgba(255,255,255,.28)'); seam.addColorStop(.58, 'rgba(0,0,0,.08)'); seam.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = seam; g.fillRect(c.width / 2 - 26, 0, 52, c.height);
  }
  // film puckers where the pouch meets each end seal
  g.save(); g.lineCap = 'round';
  [[0, 1], [c.height, -1]].forEach(([y0, dir]) => {
    for (let i = 0; i < 9; i++) {
      const x = 40 + (i / 8) * (c.width - 80) + (Math.random() - .5) * 24, len = 90 + Math.random() * 120;
      const gr = g.createLinearGradient(0, y0, 0, y0 + dir * len);
      gr.addColorStop(0, i % 2 ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.10)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.strokeStyle = gr; g.lineWidth = 10 + Math.random() * 14;
      g.beginPath(); g.moveTo(x, y0); g.quadraticCurveTo(x + (x - c.width / 2) * -.08, y0 + dir * len * .5, x + (x - c.width / 2) * -.14, y0 + dir * len); g.stroke();
    }
  });
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/* ---------- geometry ---------- */
export const W = 0.62, D = 0.2, BODY_H = 2.2, CAP_H = 0.26, SEAL = 0.2;
function pillow(h, taperTop, taperBottom) {
  const geo = new THREE.BoxGeometry(W, h, D, 18, 48, 2);
  const p = geo.attributes.position;
  const hw = W / 2, hh = h / 2;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const fx = Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(x) / hw, 3.2)));
    let fy = 1;
    if (taperTop && y > hh - 0.22) fy = Math.max(0.06, (hh - y) / 0.22);
    if (taperBottom && y < -hh + 0.22) fy = Math.max(0.06, (y + hh) / 0.22);
    fy = Math.sin(fy * Math.PI / 2);
    p.setZ(i, z * Math.max(0.04, fx * fy));
  }
  geo.computeVertexNormals();
  return geo;
}
function sealGeo() {
  const geo = new THREE.BoxGeometry(W, SEAL, 0.02, 1, 60, 1);
  geo.translate(0, SEAL / 2, 0);
  const p = geo.attributes.position, RIBS = 5;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / SEAL, z = p.getZ(i);
    const rib = Math.pow(Math.max(0, Math.sin(y * Math.PI * 2 * RIBS - Math.PI / 2) * .5 + .5), 1.6);
    p.setZ(i, Math.sign(z) * (0.006 + rib * 0.016));
  }
  geo.computeVertexNormals();
  return geo;
}

const MATS = {};
function mats(key) {
  if (MATS[key]) return MATS[key];
  const f = FLAVORS[key];
  const soft = { roughness: 0.4, clearcoat: 0.22, clearcoatRoughness: 0.45, sheen: 0.4, sheenRoughness: 0.5, sheenColor: new THREE.Color('#ffffff'), envMapIntensity: 0.3 };
  return (MATS[key] = {
    side: new THREE.MeshPhysicalMaterial({ color: f.pack, ...soft }),
    front: new THREE.MeshPhysicalMaterial({ map: labelTexture(f, false, key), ...soft }),
    back: new THREE.MeshPhysicalMaterial({ map: labelTexture(f, true, key), ...soft }),
  });
}
export function makePacket(key) {
  const f = FLAVORS[key];
  const { side, front, back } = mats(key);
  const group = new THREE.Group();
  group.userData = { key, front, back };

  const body = new THREE.Mesh(pillow(BODY_H, false, true), [side, side, side, side, front, back]);
  body.position.y = 0; body.castShadow = true;
  group.add(body);
  const sealMat = side;
  const bottomSeal = new THREE.Mesh(sealGeo(), sealMat);
  bottomSeal.rotation.z = Math.PI; bottomSeal.position.y = -BODY_H / 2 + 0.02; bottomSeal.castShadow = true;
  group.add(bottomSeal);

  // tear-off cap
  const cap = new THREE.Group();
  const capBody = new THREE.Mesh(pillow(CAP_H, true, false), side);
  capBody.position.y = CAP_H / 2; capBody.castShadow = true;
  const topSeal = new THREE.Mesh(sealGeo(), sealMat);
  topSeal.position.y = CAP_H - 0.02; topSeal.castShadow = true;
  cap.add(capBody, topSeal);
  cap.position.y = BODY_H / 2 + 0.004;
  cap.userData.home = cap.position.clone();
  group.add(cap);
  // notch hint
  const notch = new THREE.Mesh(new THREE.BoxGeometry(W * 0.98, 0.008, D * 0.5), new THREE.MeshBasicMaterial({ color: f.ink, transparent: true, opacity: 0.0 }));
  notch.position.y = BODY_H / 2; group.add(notch);
  group.userData.cap = cap; group.userData.notch = notch; group.userData.body = body;
  group.userData.opening = new THREE.Vector3(0, BODY_H / 2, 0);
  return group;
}

