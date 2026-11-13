// Thin Supabase REST helper for public RPCs (waitlist, box reservation, contact, events).
// Uses only the public publishable key; Row Level Security and SECURITY DEFINER functions guard the data.
import { brand } from './config.js?v=20261113a';

export const apiLive = Boolean(brand.supabaseUrl && brand.supabaseAnonKey);
export const validEmail = v => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) && v.length <= 254;

// Returns { ok, status, data, missing } — missing=true when the function is not deployed yet.
export async function rpc(name, args = {}, { timeout = 15000 } = {}) {
  if (!apiLive) return { ok: false, status: 0, data: null, missing: true };
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeout);
  try {
    const r = await fetch(`${brand.supabaseUrl}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: brand.supabaseAnonKey },
      body: JSON.stringify(args),
      signal: controller.signal,
      keepalive: name === 'log_event',
    });
    const text = await r.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch (e) {}
    const missing = r.status === 404 || data?.code === 'PGRST202';
    return { ok: r.ok, status: r.status, data, missing };
  } catch (e) {
    return { ok: false, status: 0, data: null, missing: false };
  } finally { clearTimeout(t); }
}

// Add an email to the waitlist.
export const subscribe = (email, source = 'site') => rpc('subscribe', { p_email: email, p_source: source });

// Save the email together with the box mix. Falls back to the original subscribe() with the mix
// encoded in the source field until the 2026-11-12 migration has been run.
export async function reserveBox(email, pack, mix, source = 'box') {
  const r = await rpc('reserve_box', { p_email: email, p_pack: String(pack), p_mix: mix, p_source: source });
  if (!r.missing) return r;
  return subscribe(email, `box:${pack}:m${mix.matcha}-a${mix.acai}-c${mix.coffee}`);
}

// First-party analytics: event name + page path only. No cookies, no personal data.
export function track(name, detail = '') {
  if (!apiLive || !/^[a-z0-9_:-]{1,40}$/.test(name)) return;
  rpc('log_event', { p_name: name, p_page: location.pathname.slice(0, 120), p_detail: String(detail).slice(0, 120) }).catch(() => {});
}

let countPromise = null;
export function waitlistCount() {
  countPromise ||= rpc('waitlist_count').then(r => (r.ok && Number.isFinite(r.data) ? r.data : null));
  return countPromise;
}
