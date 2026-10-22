// Client-side admin auth helpers.
// The real credential is the httpOnly `zion_admin_session` cookie set by
// /api/admin/login — JS cannot read it. `zion_admin_ui` is a non-httpOnly
// marker cookie used only for UI gating (server always re-verifies).

const MARKER = 'zion_admin_ui';

function hasMarker(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some((c) => c.trim().startsWith(`${MARKER}=`));
}

/** UI gate only — the server verifies the httpOnly session cookie. */
export function isAuthenticated(): boolean {
  return hasMarker();
}

/** Server truth — asks the API whether the session cookie is valid. */
export async function checkAdminSession(): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/session', { credentials: 'same-origin' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function adminLogout(): Promise<void> {
  try {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
  } finally {
    if (typeof document !== 'undefined') {
      document.cookie = `${MARKER}=; path=/; max-age=0`;
    }
  }
}
