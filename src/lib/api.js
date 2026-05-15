// lib/api.js  (frontend)
// ─────────────────────────────────────────────────────────────────────────────
// All requests go to a SINGLE backend endpoint:
//   https://your-backend.vercel.app/api/settings
// routed via ?resource= and ?section= query params.
//
// Set NEXT_PUBLIC_API_BASE in your frontend .env.local:
//   NEXT_PUBLIC_API_BASE=https://your-backend.vercel.app
// ─────────────────────────────────────────────────────────────────────────────

const BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';
const ENDPOINT = `${BASE}/api/settings`;

// Default user id — replace with real auth (NextAuth session, JWT, etc.)
function getUserId() {
  return 'default_admin';
}

function headers(extra = {}) {
  return {
    'Content-Type': 'application/json',
    'x-user-id': getUserId(),
    ...extra,
  };
}

// ── Settings sections ─────────────────────────────────────────────────────────

export async function fetchSection(section) {
  const res = await fetch(`${ENDPOINT}?resource=section&section=${section}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Failed to load ${section}`);
  return res.json(); // { data, source }
}

export async function saveSection(section, payload) {
  const res = await fetch(`${ENDPOINT}?resource=section&section=${section}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || `Failed to save ${section}`);
  }
  return res.json(); // { success: true }
}

// ── Sessions ─────────────────────────────────────────────────────────────────

export async function fetchSessions() {
  const res = await fetch(`${ENDPOINT}?resource=sessions`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error('Failed to load sessions');
  return res.json(); // { sessions: [...] }
}

export async function revokeSession(id) {
  const res = await fetch(`${ENDPOINT}?resource=sessions&id=${id}`, {
    method: 'DELETE',
    headers: headers(),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || 'Failed to revoke session');
  }
  return res.json(); // { success: true }
}