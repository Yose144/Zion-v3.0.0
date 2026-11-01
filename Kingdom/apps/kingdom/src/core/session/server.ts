import { cookies } from 'next/headers';
import { SESSION_COOKIE, getCurrentUser, type ZisUser } from '@zion/session';

/**
 * Session v Kingdomu.
 *
 * Cookie drží hostitel okna (ZIS ji vydal), portály ji jen čtou. Server volá
 * ZIS přes loopback a předává cookie explicitně — prohlížeč žádný ZIS nevolá,
 * takže nepotřebujeme CORS ani druhou session.
 */
export async function getSession(): Promise<ZisUser | null> {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE)?.value;
  if (!value) return null;

  try {
    return await getCurrentUser(value);
  } catch {
    return null;
  }
}
