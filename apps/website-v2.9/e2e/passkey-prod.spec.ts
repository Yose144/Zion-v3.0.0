import { test, expect, type Page } from '@playwright/test';
import * as bip39 from 'bip39';
import { loginWithMnemonic } from './lib/zis-login';

/**
 * Passkey (WebAuthn) PRODUCTION E2E — real ZIS ceremonies on live origins,
 * no mocks (3.B1 / V33-4 evidence).
 *
 *   register → login → recovery(delete + re-register) on app origin
 *   login with the SAME passkey on market + freeworld (cross-origin RP)
 *
 * A fresh mnemonic generates a brand-new disposable ZIS user per run —
 * no shared secret needed, nothing funds-adjacent touched.
 *
 * Run:
 *   npx playwright test e2e/passkey-prod.spec.ts
 */

const ORIGINS = {
  app: 'https://app.zionterranova.com',
  market: 'https://market.zionterranova.com',
  freeworld: 'https://freeworld.zionterranova.com',
};

/** Attach a CDP virtual authenticator (resident keys + UV) to the page. */
async function addVirtualAuthenticator(page: Page) {
  const client = await page.context().newCDPSession(page);
  await client.send('WebAuthn.enable');
  const { authenticatorId } = await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  await client.send('WebAuthn.setAutomaticPresenceSimulation', {
    authenticatorId,
    enabled: true,
  });
  return { client, authenticatorId };
}

/**
 * Self-contained browser-side ceremony runner — serialized into the page.
 * kind=register → POST register/options → credentials.create → register/verify
 * kind=login    → POST login/options    → credentials.get    → login/verify
 */
async function passkeyCeremony(args: { kind: string; label?: string }) {
  const { kind, label } = args;
  const b64uToBuf = (s: string): ArrayBuffer =>
    Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
      .buffer as ArrayBuffer;
  const bufToB64u = (buf: ArrayBuffer): string => {
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const jpost = async (path: string, body: unknown) => {
    const r = await fetch(path, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      throw new Error(`${path} → ${r.status}: ${(await r.text()).slice(0, 300)}`);
    }
    return r.json();
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const credJson = (c: any) => ({
    id: c.id,
    rawId: bufToB64u(c.rawId),
    type: c.type,
    authenticatorAttachment: c.authenticatorAttachment ?? 'platform',
    clientExtensionResults: c.getClientExtensionResults(),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const credsIn = (list: any[]) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (list ?? []).map((e: any) => ({ ...e, id: b64uToBuf(e.id) }));

  if (kind === 'register') {
    const { ceremonyId, options } = await jpost('/api/auth/webauthn/register/options', {});
    const cred = (await navigator.credentials.create({
      publicKey: {
        ...options,
        challenge: b64uToBuf(options.challenge),
        user: { ...options.user, id: b64uToBuf(options.user.id) },
        excludeCredentials: credsIn(options.excludeCredentials),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })) as any;
    const resp = cred.response;
    return jpost('/api/auth/webauthn/register/verify', {
      ceremonyId,
      label: label ?? 'e2e-prod',
      response: {
        ...credJson(cred),
        response: {
          clientDataJSON: bufToB64u(resp.clientDataJSON),
          attestationObject: bufToB64u(resp.attestationObject),
          transports: typeof resp.getTransports === 'function' ? resp.getTransports() : ['internal'],
        },
      },
    });
  }

  const { ceremonyId, options } = await jpost('/api/auth/webauthn/login/options', {});
  const cred = (await navigator.credentials.get({
    publicKey: {
      ...options,
      challenge: b64uToBuf(options.challenge),
      allowCredentials: credsIn(options.allowCredentials),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any;
  const resp = cred.response;
  return jpost('/api/auth/webauthn/login/verify', {
    ceremonyId,
    response: {
      ...credJson(cred),
      response: {
        clientDataJSON: bufToB64u(resp.clientDataJSON),
        authenticatorData: bufToB64u(resp.authenticatorData),
        signature: bufToB64u(resp.signature),
        userHandle: resp.userHandle ? bufToB64u(resp.userHandle) : null,
      },
    },
  });
}

async function listCredentials(page: Page) {
  return page.evaluate(async () => {
    const r = await fetch('/api/auth/webauthn/credentials', { credentials: 'include' });
    if (!r.ok) throw new Error(`credentials → ${r.status}`);
    return r.json() as Promise<{ credentials: { id: string; credentialId: string }[] }>;
  });
}

async function deleteCredential(page: Page, id: string) {
  return page.evaluate(async (cid) => {
    const r = await fetch(`/api/auth/webauthn/credentials/${cid}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!r.ok) throw new Error(`delete credential → ${r.status}`);
    return r.json();
  }, id);
}

/** Session sanity: /api/auth/me must return the user with our address prefix. */
async function expectSession(page: Page, addressPrefix: string) {
  const me = await page.evaluate(async () => {
    const r = await fetch('/api/auth/me', { credentials: 'include' });
    return r.ok ? r.json() : null;
  });
  expect(me?.primaryAddress ?? '').toContain(addressPrefix.slice(0, 12));
  return me;
}

test.describe.serial('passkey production E2E (real ZIS, virtual authenticator)', () => {
  test.setTimeout(180_000);

  test('register on app + login on app/market/freeworld + recovery', async ({ browser }) => {
    // Fresh disposable ZIS user — ed25519 challenge-response session.
    const mnemonic = bip39.generateMnemonic();
    const cookie = await loginWithMnemonic(mnemonic);
    const context = await browser.newContext();
    await context.addCookies([cookie]);
    const page = await context.newPage();

    // ── app: session sanity (mnemonic-derived test user exists) ──
    await page.goto(`${ORIGINS.app}/`);
    const me0 = await page.evaluate(async () => {
      const r = await fetch('/api/auth/me', { credentials: 'include' });
      return r.ok ? r.json() : null;
    });
    const addr = me0?.primaryAddress as string;
    expect(addr).toBeTruthy();

    // One authenticator shared across navigations — the resident
    // credential persists and proves cross-origin passkey SSO.
    const { authenticatorId } = await addVirtualAuthenticator(page);

    // ── app: REGISTER ───────────────────────────────────────────
    const reg = await page.evaluate(passkeyCeremony, {
      kind: 'register',
      label: 'e2e-prod-app',
    });
    expect(reg.credential?.credentialId ?? '').toBeTruthy();
    const credId1 = reg.credential.id;

    // ── app: LOGIN ──────────────────────────────────────────────
    const login1 = await page.evaluate(passkeyCeremony, { kind: 'login' });
    expect(login1.user?.id ?? login1.sub ?? '').toBeTruthy();
    await expectSession(page, addr);

    // ── market: LOGIN with the same passkey (cross-origin) ──────
    await page.goto(`${ORIGINS.market}/`);
    const loginM = await page.evaluate(passkeyCeremony, { kind: 'login' });
    expect(loginM.user?.id ?? loginM.sub ?? '').toBeTruthy();
    await expectSession(page, addr);

    // ── freeworld: LOGIN with the same passkey ──────────────────
    await page.goto(`${ORIGINS.freeworld}/`);
    const loginF = await page.evaluate(passkeyCeremony, { kind: 'login' });
    expect(loginF.user?.id ?? loginF.sub ?? '').toBeTruthy();
    await expectSession(page, addr);

    // ── app: RECOVERY — delete passkey, re-register, re-login ───
    await page.goto(`${ORIGINS.app}/`);
    const list = await listCredentials(page);
    const row = list.credentials.find((c) => c.id === credId1) ?? list.credentials[0];
    expect(row?.id).toBeTruthy();
    await deleteCredential(page, row.id);

    const reg2 = await page.evaluate(passkeyCeremony, {
      kind: 'register',
      label: 'e2e-prod-recovery',
    });
    expect(reg2.credential?.credentialId ?? '').toBeTruthy();
    const login2 = await page.evaluate(passkeyCeremony, { kind: 'login' });
    expect(login2.user?.id ?? login2.sub ?? '').toBeTruthy();
    await expectSession(page, addr);

    // Cleanup: delete the recovery passkey too — leave the test
    // account as close to pristine as a prod DB allows.
    const list2 = await listCredentials(page);
    for (const c of list2.credentials) await deleteCredential(page, c.id);

    const client = await page.context().newCDPSession(page);
    await client.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
    await context.close();
  });
});
