// Base URL comes from VITE_API_URL (baked in at build time by Vite).
export const API_URL = (
  import.meta.env.VITE_API_URL ?? 'http://localhost:5000'
).replace(/\/$/, '');

// Minimal helper for Phase 0. Phase 1 extends it with the auth token.
export async function apiGet(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, options);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}
