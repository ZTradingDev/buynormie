import { brand, products, ROOT } from './config.js?v=20261113b';
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const arrow = '<span aria-hidden="true" class="arrow">↗</span>';
export const roll = text => `<span class="roll"><span>${esc(text)}</span><span aria-hidden="true">${esc(text)}</span></span>`;
export const money = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: brand.currency || 'USD' }).format(n);
export const FDA = 'These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.';
export const legalLinks = () => `<a href="${ROOT}privacy/index.html">Privacy Policy</a> and <a href="${ROOT}terms/index.html">Terms</a>`;
// Lowest available price per stick across packs, or null until prices are set.
export function perStick() {
  const opts = [[brand.pack6Price, 6], [brand.pack12Price, 12], [brand.specialPrice, 12]].filter(([p]) => typeof p === 'number');
  return opts.length ? Math.min(...opts.map(([p, n]) => p / n)) : null;
}
export function cta(text, href, cls = '') { return `<a class="button ${cls}" href="${href}">${roll(text)}${arrow}</a>`; }
export function image(p, cls = '', eager = false) {return `<div class="image-frame ${cls}" style="--product-color:${p.color}"><img src="${p.image}" alt="${esc(p.gallery[0].alt)}" width="1024" height="1280" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"><span class="image-error" hidden>normie. ${esc(p.name)}<small>Image unavailable. Explore the flavor details below.</small></span></div>`;}
export function card(p) {return `<article class="product-card" data-product="${p.id}" style="--product-color:${p.color};--product-ink:${p.ink}"><div class="card-image"><a href="${p.url}" aria-label="Explore ${esc(p.name)}">${image(p)}</a><span class="card-tag">${p.id === 'acai' ? '+ collagen' : p.category === 'tea' ? 'the green ritual' : 'the morning ritual'}</span><button class="quick-button" data-quick="${p.id}" aria-label="Quick view ${esc(p.name)}">+</button></div><div class="card-meta"><div><a href="${p.url}"><h3>${esc(p.name)}</h3></a><p>6- or 12-packs · reserve now</p></div><a class="circle-link" href="${p.url}" aria-label="Explore ${esc(p.name)}">↗</a></div></article>`;}
export function accordion(title, content, id) {return `<div class="accordion"><h3><button aria-expanded="false" aria-controls="${id}" data-accordion>${esc(title)}<span class="plus" aria-hidden="true"></span></button></h3><div class="accordion-panel" id="${id}"><div><div class="accordion-content">${content}</div></div></div></div>`;}

/* ---------- Supplement Facts ---------- */
const LABEL = {
  'Matcha': 'Matcha green tea (Camellia sinensis) leaf powder',
  'Cereboost®': 'American ginseng root extract (Cereboost®)',
  'Açaí powder': 'Açaí (Euterpe oleracea) fruit powder',
  'VERISOL® B collagen': 'Bovine collagen peptides (VERISOL® B)',
  'Wheat-derived ceramides': 'Wheat ceramides (Céramosides™)',
  'Cognizin® citicoline': 'Citicoline (Cognizin®)',
  'enXtra®': 'Alpinia galanga rhizome extract (enXtra®)',
  'affron®': 'Saffron stigma extract (affron®)',
};
// FDA Daily Values (adults, 21 CFR 101.9 / 101.36)
const DV = { 'Vitamin C': 90, 'Sodium': 2300, 'Potassium': 4700, 'Magnesium': 420 };
const ORDER = ['Vitamin C', 'Magnesium', 'Sodium', 'Potassium'];
const amount = s => String(s).replace(/\s+(total|added)$/i, '');
export function supplementFacts(p) {
  const rows = p.ingredients.map(i => ({ name: i[1], amt: amount(i[2]) }));
  const dv = rows.filter(r => DV[r.name]).sort((a, b) => ORDER.indexOf(a.name) - ORDER.indexOf(b.name));
  const other = rows.filter(r => !DV[r.name]);
  const pct = r => `${Math.round(parseFloat(r.amt) / DV[r.name] * 100)}%`;
  const tr = (label, amt, d, cls = '') => `<tr class="${cls}"><th scope="row">${esc(label)}</th><td>${esc(amt)}</td><td>${d}</td></tr>`;
  return `<div class="supp-facts" role="group" aria-label="Supplement Facts for ${esc(p.name)}"><p class="sf-title">Supplement Facts</p><p class="sf-serving">Serving Size 1 Stick<br>Servings Per Container 6 or 12</p><table><thead><tr><th scope="col"></th><th scope="col">Amount Per Serving</th><th scope="col">% Daily Value</th></tr></thead><tbody>${dv.map(r => tr(r.name, r.amt, pct(r))).join('')}${other.map((r, i) => tr(LABEL[r.name] || r.name, r.amt, '†', i === 0 && dv.length ? 'sf-split' : '')).join('')}</tbody></table><p class="sf-foot">${dv.length ? 'Percent Daily Values are based on a 2,000 calorie diet. ' : ''}† Daily Value not established.</p></div>`;
}
export function caffeineLine(p) {
  if (p.caffeineMg === 0) return 'Caffeine: none added. Made without caffeine ingredients.';
  if (typeof p.caffeineMg === 'number') return `Caffeine: ${p.caffeineMg} mg per stick.`;
  return `Caffeine: ${p.caffeine.replace(/\.$/, '').replace(/^Contains /, 'contains ')}. Exact amount printed on the box.`;
}
export function allergenBox(p) {
  const warn = /contains/i.test(p.allergens);
  return `<div class="allergen-box${warn ? ' has-allergen' : ''}"><p class="allergen-title">allergens</p><p>${esc(p.allergens)}</p><p class="allergen-caffeine">${esc(caffeineLine(p))}</p></div>`;
}
export function ingredients(p) {return supplementFacts(p);}
function directions(p) {return `<ol class="directions">${p.directions.map(d => `<li>${esc(d)}</li>`).join('')}</ol>`;}
function warnings(p) {return `<p>${esc(caffeineLine(p))}</p>${p.caffeineMg === 0 ? '' : '<p>Not recommended for children or for people sensitive to caffeine.</p>'}<p>Talk to your doctor before use if you are pregnant, nursing, taking medication, or have a medical condition. Keep out of reach of children. Store in a cool, dry place.</p>`;}

export function productInfo(p, prefix='product', compact=false) {
  const ps = perStick();
  const price = ps ? `<p class="product-price">from ${money(ps)} per stick</p>` : '<p class="product-price muted">price announced at launch</p>';
  return `<div class="product-info" data-info style="--product-color:${p.color};--product-ink:${p.ink}"><p class="eyebrow">in 6- and 12-packs</p><h1 class="product-name">${esc(p.name)}${p.id === 'acai' ? '<small>+ collagen</small>' : ''}</h1><p class="product-lead">${esc(p.hero)}</p><p class="product-benefit">${esc(p.benefit)}<sup>*</sup></p>${price}${compact?'':`<a class="order-cta order-this" href="${ROOT}index.html#order" data-track="cta_reserve_product"><span>reserve your box</span><i aria-hidden="true">↗</i></a>`}<fieldset class="variant-field"><legend>choose your flavor</legend><div class="variant-options">${products.map(v=>`<button type="button" data-variant="${v.id}" class="variant ${v.id === p.id ? 'selected' : ''}" aria-pressed="${v.id === p.id}" style="--swatch:${v.color}"><span aria-hidden="true"></span>${esc(v.name)}</button>`).join('')}</div></fieldset><p class="body-copy">${esc(p.lead)}</p>${allergenBox(p)}<div class="availability"><span class="status-dot" aria-hidden="true"></span>Not shipping yet. Reserve your box to be first in line.</div><button class="button wide" data-save="${p.id}">${roll('save this flavor')}${arrow}</button><div class="detail-accordions">${accordion('supplement facts',supplementFacts(p),`${prefix}-ingredients`)}${accordion('how to make it',directions(p),`${prefix}-directions`)}${accordion('caffeine & warnings',warnings(p),`${prefix}-before`)}${accordion('the pack',`<p>Comes in a 6-pack (2 of each flavor) or a 12-pack (4 of each flavor) of individually wrapped sticks. Or build the normie special: 12 sticks in any mix you choose.</p>`,`${prefix}-pack`)}</div><p class="small muted concept-note">normie is in development. Amounts shown are pre-production targets, and packaging and photos are concept artwork. The final label prints on every box.</p><p class="small muted fda-note"><sup>*</sup>${FDA}</p>${compact ? `<a class="text-link full-details" data-detail-link href="${p.url}">all the details ↗</a>` : ''}</div>`;}

export function form(kind='waitlist', id='newsletter') {const contact=kind==='contact';return `<form class="brand-form" data-form="${kind}" novalidate><p class="form-label">${contact ? 'leave us a note' : 'your email, please'}</p>${contact?`<label for="${id}-name">Name</label><input id="${id}-name" name="name" autocomplete="name" maxlength="120" aria-describedby="${id}-status" required>`:''}<label ${!contact?'class="sr-only"':''} for="${id}-email">Email address</label><div class="input-row"><input id="${id}-email" name="email" type="email" autocomplete="email" placeholder="you@email.com" aria-describedby="${id}-status ${id}-disclosure" required>${!contact?`<button type="submit" aria-label="Join the waitlist">↗</button>`:''}</div>${contact?`<label for="${id}-message">Your message</label><textarea id="${id}-message" name="message" rows="5" maxlength="4000" aria-describedby="${id}-status" required></textarea><button class="button" type="submit">${roll('send message')}${arrow}</button>`:''}<p id="${id}-disclosure" class="small form-disclosure">${contact ? `We use your email only to reply. See our ${legalLinks()}.` : `Launch news, first. Unsubscribe anytime. See our ${legalLinks()}.`}</p><p id="${id}-status" class="form-status small" role="status" aria-live="polite"></p></form>`;}
