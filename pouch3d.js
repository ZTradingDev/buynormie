// Clear stand-up zipper pouch holding 12 normie. sticks, modeled after the packaging turnaround references.
import * as THREE from './vendor/three.module.js';
import { FLAVORS, makePacket } from './packets3d.js';

export const PW = 1.9, PH = 2.7, PD = 0.56;
const FORMULA = {
  matcha: { sub: 'matcha + collagen', rows: [['Natural caffeine (total)', '125 mg'], ['L-theanine', '200 mg'], ['Bovine collagen peptides', '2.5 g'], ['Ginger root', '1.2 g'], ['Dandelion root extract', 'dose pending'], ['Bacillus coagulans probiotic', '2 billion CFU'], ['Magnesium', '150 mg'], ['Vitamin C', '90 mg'], ['Vitamin B12', '6 mcg'], ['Monk fruit', 'approx 30 mg'], ['Ceremonial matcha', '2.5 g']] },
  acai: { sub: 'açaí + collagen', rows: [['Natural caffeine (total)', '125 mg'], ['L-theanine', '200 mg'], ['Bovine collagen peptides', '2.5 g'], ['Ginger root', '1.2 g'], ['Dandelion root extract', 'dose pending'], ['Bacillus coagulans probiotic', '2 billion CFU'], ['Magnesium', '150 mg'], ['Vitamin C', '90 mg'], ['Vitamin B12', '6 mcg'], ['Monk fruit', 'approx 30 mg'], ['Açaí powder', '4.0 g']] },
  coffee: { sub: 'tiramisu coffee + collagen', rows: [['Caffeine (total)', '125 mg'], ['L-theanine', '200 mg'], ['Collagen', '2.5 g'], ['Ginger root', '1.2 g'], ['Dandelion root extract', 'dose pending'], ['Bacillus coagulans probiotic', '2 billion CFU'], ['Magnesium', '150 mg'], ['Vitamin C', '90 mg'], ['Vitamin B12', '6 mcg'], ['Monk fruit', 'approx 30 mg'], ['Decaf instant coffee', '3.0 g']] },
};

// front and back film share one surface function: flat seal at the top, full bulge at the gusset
function filmGeo() {
  const geo = new THREE.PlaneGeometry(PW, PH, 40, 60);
  const p = geo.attributes.position, hw = PW / 2;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const v = (y + PH / 2) / PH;
    const fx = Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(x) / hw, 4)));
    const fy = v < 0.5 ? 1 : 1 - THREE.MathUtils.smoothstep(v, 0.5, 0.93) * 0.94;
    // faint crinkles so reflections break up like real film
    const crinkle = (Math.sin(x * 9 + y * 3.1) * 0.5 + Math.sin(y * 13.7 - x * 4.3) * 0.5) * 0.006 * fx;
    p.setZ(i, (PD / 2) * fx * fy + crinkle);
  }
  geo.computeVertexNormals();
  return geo;
}

function canvasTex(draw, w = 760, h = 1080) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.textBaseline = 'middle'; draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const sp = (g, px) => { try { g.letterSpacing = `${px}px`; } catch (e) {} };

function frontPrint(key) {
  const f = FLAVORS[key];
  return canvasTex((g, w, h) => {
    // zipper ridges and top seal
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, 0, w, 52);
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 4;
    [92, 104].forEach(y => { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); });
    g.strokeStyle = 'rgba(120,120,120,.25)'; g.lineWidth = 2;
    [98, 110].forEach(y => { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); });
    // wordmark printed on the film
    g.fillStyle = f.ink; g.textAlign = 'center'; sp(g, -3);
    g.font = '700 150px DM, Arial, sans-serif'; g.fillText('normie.', w / 2, 270); sp(g, 0);
    // cream label card, bottom left
    const x = 70, y = 780, cw = 430, ch = 210;
    g.fillStyle = '#f5ecdc'; g.beginPath(); g.roundRect(x, y, cw, ch, 22); g.fill();
    g.fillStyle = f.ink; g.textAlign = 'left';
    g.font = '700 54px DM, Arial, sans-serif'; g.fillText(f.name, x + 28, y + 52);
    g.fillStyle = '#3b3a33'; g.font = '400 26px DM, Arial, sans-serif'; g.fillText('organic · mood elevating · detox', x + 28, y + 110);
    g.font = '400 24px DM, Arial, sans-serif'; g.fillText('12 stick packs', x + 28, y + 162);
  });
}

function backPrint(key) {
  const f = FLAVORS[key], F = FORMULA[key];
  return canvasTex((g, w, h) => {
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, 0, w, 52);
    const x = 110, y = 210, cw = w - 220, ch = 800;
    g.fillStyle = '#f5ecdc'; g.beginPath(); g.roundRect(x, y, cw, ch, 30); g.fill();
    g.textAlign = 'center'; g.fillStyle = f.ink;
    g.font = '700 84px DM, Arial, sans-serif'; g.fillText('normie.', w / 2, y + 80);
    g.font = '400 30px DM, Arial, sans-serif'; g.fillText(F.sub, w / 2, y + 134);
    g.fillStyle = f.ink; g.globalAlpha = .75; g.beginPath(); g.roundRect(x + 30, y + 164, 250, 32, 16); g.fill(); g.globalAlpha = 1;
    g.fillStyle = '#f5ecdc'; g.font = '700 17px DM, Arial, sans-serif'; sp(g, 3); g.fillText('PROPOSED FORMULA', x + 155, y + 181); sp(g, 0);
    g.fillStyle = '#2f2e28'; g.textAlign = 'right'; g.font = '700 19px DM, Arial, sans-serif'; g.fillText('Amount per stick', x + cw - 40, y + 220);
    F.rows.forEach(([a, b], i) => {
      const ry = y + 254 + i * 33;
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + 40, ry + 16); g.lineTo(x + cw - 40, ry + 16); g.stroke();
      g.font = '400 20px DM, Arial, sans-serif'; g.textAlign = 'left'; g.fillText(a, x + 44, ry); g.textAlign = 'right'; g.fillText(b, x + cw - 44, ry);
    });
    g.textAlign = 'left'; g.font = '400 15px DM, Arial, sans-serif';
    ['Warnings: Not for use by pregnant or nursing individuals.', 'Consult a healthcare professional if you have a medical', 'condition or are taking medication. Discontinue use if', 'adverse reactions occur.'].forEach((l, i) => g.fillText(l, x + 44, y + 636 + i * 22));
    g.font = '400 17px DM, Arial, sans-serif'; g.fillText('LOT:', x + 44, y + 730); g.fillText('BEST BY:', x + cw / 2, y + 730);
    g.fillStyle = f.ink; g.globalAlpha = .8; g.beginPath(); g.roundRect(x + 30, y + ch - 56, cw - 60, 34, 17); g.fill(); g.globalAlpha = 1;
    g.fillStyle = '#f5ecdc'; g.textAlign = 'center'; g.font = '700 16px DM, Arial, sans-serif'; sp(g, 3); g.fillText('FORMULATION DRAFT · NOT FOR RETAIL', w / 2, y + ch - 39); sp(g, 0);
  });
}

const FILM = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0, metalness: 0, transmission: 0.96, thickness: 0, ior: 1.4, transparent: true, opacity: 1, clearcoat: 0.6, clearcoatRoughness: 0.05, envMapIntensity: 0.65, specularIntensity: 0.8, depthWrite: false, side: THREE.DoubleSide });
const SEAM = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.15, transparent: true, opacity: 0.45, clearcoat: 1, envMapIntensity: 1.2, depthWrite: false });

export function makePouch(key, { sticks = true } = {}) {
  const pouch = new THREE.Group();
  const geo = filmGeo();
  const back = geo.clone(); back.rotateY(Math.PI);
  const front = new THREE.Mesh(geo, FILM); front.renderOrder = 2;
  const backM = new THREE.Mesh(back, FILM); backM.renderOrder = 2;
  const printMat = map => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, toneMapped: false });
  const fp = new THREE.Mesh(geo, printMat(frontPrint(key))); fp.renderOrder = 3;
  const bp = new THREE.Mesh(back, printMat(backPrint(key))); bp.renderOrder = 3;
  pouch.add(backM, bp, front, fp);
  // side seals and the gusset base
  [-1, 1].forEach(s => { const seam = new THREE.Mesh(new THREE.BoxGeometry(.05, PH, .012), SEAM); seam.position.x = s * PW / 2; seam.renderOrder = 2; pouch.add(seam); });
  const top = new THREE.Mesh(new THREE.BoxGeometry(PW, .12, .02), SEAM); top.position.y = PH / 2 - .06; top.renderOrder = 2; pouch.add(top);
  const baseShape = new THREE.Shape(); const n = 30;
  for (let i = 0; i <= n; i++) { const x = -PW / 2 + (i / n) * PW; const fx = Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(x) / (PW / 2), 4))); baseShape.lineTo(x, (PD / 2) * fx); }
  for (let i = n; i >= 0; i--) { const x = -PW / 2 + (i / n) * PW; const fx = Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(x) / (PW / 2), 4))); baseShape.lineTo(x, -(PD / 2) * fx); }
  const base = new THREE.Mesh(new THREE.ShapeGeometry(baseShape), SEAM); base.rotation.x = Math.PI / 2; base.position.y = -PH / 2; base.renderOrder = 2; pouch.add(base);
  // twelve sticks standing inside: three rows of four
  if (sticks) {
    const s = .52;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      const m = makePacket(key); m.scale.setScalar(s);
      m.position.set((c - 1.5) * .4, -PH / 2 + .04 + 1.32 * s + r * .02, .13 - r * .13);
      m.rotation.set(0, 0, (c - 1.5) * .012);
      pouch.add(m);
    }
  }
  pouch.userData.key = key;
  return pouch;
}
