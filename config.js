import { flavors } from './flavors.js?v=20261113b';
export const ROOT = new URL('./', import.meta.url).href;

// Edit brand, products, integrations, and motion here. Rebuild HTML with npm run build.
export const brand = {
  name: 'normie.',
  tagline: 'a little ritual. all yours.',
  description: 'normie drink sticks: matcha, açaí + collagen, and tiramisu coffee. Build a 6- or 12-pack your way and reserve your first box.',
  announcement: 'first boxes are coming',
  status: 'prelaunch',
  packCount: 12,
  currency: 'USD',
  // Waitlist, box reservations, contact form and events go to Supabase (see api.js and backend/migrations).
  contactEmail: 'normieszn@gmail.com',
  // Show the waitlist counter only once the list reaches this size.
  waitlistCounterMin: 100,
  // Social profiles: full https URLs. Links appear in the footer once set.
  instagram: '',
  tiktok: '',
  website: 'https://buynormie.com',
  // Prices shown on the site (numbers, e.g. 15 and 28). The amount charged comes from the payment processor.
  // Leave null to show "price at launch". Per-stick prices are worked out from these.
  // Turn on once the payment processor and create-checkout function are live.
  checkoutLive: false,
  specialPrice: null,   // the normie special: set 12-pack, 4 of each flavor
  pack6Price: null,
  pack12Price: null,
  // Boxes needed for a free box. Must match REWARDS_GOAL in the stripe-webhook function.
  rewardsGoal: 5,
  // Supabase project (Settings > API). The publishable (anon) key is public by design; Row Level Security protects the data.
  // Never put the service_role key or any Stripe secret key here.
  supabaseUrl: 'https://lxqtyfjglgjyjnnptnop.supabase.co',
  supabaseAnonKey: 'sb_publishable_2sXrVgf-Z_M_tuqj7jiaFA_KZ2oXgec',
};
export const motion = {
  fast: 180, ui: 260, panel: 400, close: 240,
  heroMedia: 850, heroText: 650, heroStagger: 80,
  reveal: 600, variant: 280, background: 350,
  ease: 'cubic-bezier(0.22,1,0.36,1)',
  interfaceEase: 'cubic-bezier(0.4,0,0.2,1)',
};
const presentation = {
  matcha: { color: '#dce3ce', ink: '#354b3d', noteShort: 'earthy. green. unmistakably matcha.', category: 'tea', descriptor: 'matcha drink sticks', mood: 'a green kind of morning.', hero: 'A familiar green ritual, made your own.', lead: 'Real matcha with L-theanine and American ginseng, in one stick.', caffeine: 'Contains naturally occurring caffeine from matcha.', caffeineMg: null, benefit: 'Calm, focused energy without the coffee crash.', directions: ['Tear open one stick and pour it into 8 oz (240 ml) of cold water or milk.', 'Stir or shake for 15 seconds, then add ice.', 'Prefer it hot? Whisk into 8 oz of hot (not boiling) water or steamed milk.'], allergens: 'No major food allergens in the current formula.', order: 0 },
  acai: { color: '#ead8d9', ink: '#674a51', noteShort: 'berry-forward. a little different.', category: 'fruit', descriptor: 'açaí + collagen drink sticks', mood: 'your berry little moment.', hero: 'A berry ritual with a little more to it.', lead: 'Açaí with collagen peptides, vitamin C, and electrolytes, in one stick.', caffeine: 'Made without caffeine ingredients.', caffeineMg: 0, benefit: 'Hydration and skin support, with no caffeine ingredients.', directions: ['Tear open one stick and pour it into 12 oz (355 ml) of cold water or milk.', 'Shake or stir well for 20 seconds, then add ice.', 'Best served cold.'], allergens: 'Contains: wheat. Contains bovine collagen; not vegan.', order: 1 },
  coffee: { color: '#e4d7c7', ink: '#634f3d', noteShort: 'coffee first. always.', category: 'coffee', descriptor: 'tiramisu coffee drink sticks', mood: 'for your morning, whenever it starts.', hero: 'Something familiar. A new daily ritual.', lead: 'Real coffee with citicoline, galangal, and saffron extracts, in one stick.', caffeine: 'Contains caffeine from coffee.', caffeineMg: null, benefit: 'Your morning coffee, with focus support built in.', directions: ['Tear open one stick and pour it into 8 oz (240 ml) of cold water or milk.', 'Stir or shake for 15 seconds, then add ice.', 'Prefer it hot? Stir into 8 oz of hot water or steamed milk.'], allergens: 'No major food allergens in the current formula.', order: 2 },
};
export const products = Object.entries(flavors).map(([id, formula]) => ({
  id, ...formula, ...presentation[id], price: null, available: false,
  image: `${ROOT}assets/${id}.webp`,
  gallery: [
    { src: `${ROOT}assets/${id}.webp`, alt: `Normie ${formula.name} stick with a prepared drink.`, label: 'the ritual' },
    { src: ROOT+'assets/model-study.webp', alt: 'Normie packaging for all three flavors from multiple angles.', label: 'packaging study' },
  ],
  url: `${ROOT}products/${id}/index.html`,
}));
export const findProduct = id => products.find(p => p.id === id) || products[0];
