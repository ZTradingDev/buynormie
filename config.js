import { flavors } from './flavors.js';
export const ROOT = new URL('./', import.meta.url).href;

// Edit brand, products, integrations, and motion here. Rebuild HTML with npm run build.
export const brand = {
  name: 'normie.',
  tagline: 'a little ritual. all yours.',
  description: 'Meet normie: matcha, açaí, and coffee drink sticks in development. Three flavors. One little moment for yourself.',
  announcement: 'a new everyday ritual. currently in development.',
  status: 'prelaunch',
  packCount: 12,
  currency: 'USD',
  website: 'https://normieszn.com',
  // Set same-origin endpoints only after a real service and privacy policy are ready.
  waitlistEndpoint: '',
  contactEndpoint: '',
  contactEmail: '',
  demoMode: true,
  // Ordering: set a price per box (number, e.g. 24) and a hosted checkout link (Shopify, Stripe Payment Link, etc.).
  boxPrice: null,
  checkoutUrl: '',
  // Rewards: boxes needed for a free box, and a same-origin endpoint or hosted loyalty service for sign-ups.
  rewardsGoal: 5,
  rewardsEndpoint: '',
};
export const motion = {
  fast: 180, ui: 260, panel: 400, close: 240,
  heroMedia: 850, heroText: 650, heroStagger: 80,
  reveal: 600, variant: 280, background: 350,
  ease: 'cubic-bezier(0.22,1,0.36,1)',
  interfaceEase: 'cubic-bezier(0.4,0,0.2,1)',
};
const presentation = {
  matcha: { color: '#dce3ce', ink: '#354b3d', noteShort: 'earthy. green. unmistakably matcha.', category: 'tea', descriptor: 'matcha drink sticks', mood: 'a green kind of morning.', hero: 'A familiar green ritual, made your own.', lead: 'Real matcha, L-theanine, and American ginseng are at the center of our current concept.', caffeine: 'Naturally occurring caffeine; amount to be confirmed.', order: 0 },
  acai: { color: '#ead8d9', ink: '#674a51', noteShort: 'berry-forward. a little different.', category: 'fruit', descriptor: 'açaí + collagen drink sticks', mood: 'your berry little moment.', hero: 'A berry ritual with a little more to it.', lead: 'Açaí, bovine collagen, and an electrolyte system form the foundation of this developing blend.', caffeine: 'Developed without caffeine ingredients; final testing pending.', order: 1 },
  coffee: { color: '#e4d7c7', ink: '#634f3d', noteShort: 'coffee first. always.', category: 'coffee', descriptor: 'coffee drink sticks', mood: 'for your morning, whenever it starts.', hero: 'Something familiar. A new daily ritual.', lead: 'A real coffee base with a supporting ingredient program, currently being refined.', caffeine: 'Contains caffeine; amount to be confirmed.', order: 2 },
};
export const products = Object.entries(flavors).map(([id, formula]) => ({
  id, ...formula, ...presentation[id], price: null, available: false,
  image: `${ROOT}assets/${id}.webp`,
  gallery: [
    { src: `${ROOT}assets/${id}.webp`, alt: `Normie ${formula.name} stick with a prepared drink. Concept photography.`, label: 'the ritual' },
    { src: ROOT+'assets/model-study.webp', alt: 'Normie packaging concept sheet showing all three flavors from multiple angles. Provisional artwork.', label: 'packaging study' },
  ],
  url: `${ROOT}products/${id}/index.html`,
}));
export const findProduct = id => products.find(p => p.id === id) || products[0];
