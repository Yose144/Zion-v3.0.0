import { test, expect, type Page, type Route } from '@playwright/test';
import { loginWithMnemonic } from './lib/zis-login';

/**
 * Passkey (WebAuthn) E2E — real authenticator ceremony via a CDP virtual
 * authenticator; all ZIS-facing routes are mocked at the browser boundary.
 *
 * Covers:
 *   - registration ceremony (SecurityPanel → /api/auth/webauthn/register/*)
 *   - login ceremony (/login → /api/auth/webauthn/login/* → /api/auth/me)
 *   - credential delete (DELETE /api/auth/webauthn/credentials/:id)
 *
 * The passkey UI is gated by NEXT_PUBLIC_PASSKEY_ENABLED=1 at build time —
 * specs skip cleanly when the running build does not render it.
 *
 * `/account` is protected by edge middleware that validates `zion_session`
 * server-side against real ZIS — those tests need `ZION_WALLET_MNEMONIC`
 * (same convention as multichain-dex-real.spec.ts) and skip without it.
 */

const TEST_USER = {
  id: 'e2e-passkey-user',
  primaryAddress: 'zion1passkeye2e',
  displayName: 'Passkey E2E',
  email: null,
  avatar: null,
  bio: null,
  role: 'user',
  createdAt: '2026-10-21T00:00:00Z',
  lastLogin: '2026-10-21T00:00:00Z',
  loginCount: 1,
  linkedAddresses: [],
  oasisPlayer: null,
};

// Base64url helpers — options must be valid for SimpleWebAuthn optionsJSON.
const b64url = (bytes: number[]) =>
  Buffer.from(bytes).toString('base64url');

const RP_ID = 'localhost';
const CHALLENGE = b64url(Array.from({ length: 32 }, (_, i) => (i * 7 + 13) & 0xff));
const USER_HANDLE = b64url(Array.from({ length: 16 }, (_, i) => (i * 3 + 1) & 0xff));

function creationOptionsJSON() {
  return {
    challenge: CHALLENGE,
    rp: { name: 'ZION', id: RP_ID },
    user: { id: USER_HANDLE, name: 'e2e@zion', displayName: 'Passkey E2E' },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 },
    ],
    timeout: 60_000,
    attestation: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  };
}

function requestOptionsJSON(allowId?: string) {
  return {
    challenge: b64url(Array.from({ length: 32 }, (_, i) => (i * 11 + 5) & 0xff)),
    rpId: RP_ID,
    allowCredentials: allowId ? [{ type: 'public-key', id: allowId }] : [],
    userVerification: 'preferred',
    timeout: 60_000,
  };
}

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

async function mockSession(page: Page, authenticated: boolean) {
  await page.route('**/api/auth/me', (route: Route) =>
    route.fulfill({
      status: authenticated ? 200 : 401,
      contentType: 'application/json',
      body: authenticated ? JSON.stringify(TEST_USER) : JSON.stringify({ error: 'unauthenticated' }),
    }),
  );
}

async function mockSecurityPanelApis(page: Page) {
  await page.route('**/api/auth/sessions', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sessions: [] }) }),
  );
  await page.route('**/api/auth/keys', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ keys: [] }) }),
  );
  // Linked addresses + notifications are best-effort in the panel.
  await page.route('**/api/auth/addresses', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ addresses: [] }) }),
  );
  await page.route('**/api/notifications**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ notifications: [], unread: 0 }) }),
  );
}

test.describe('Passkey WebAuthn E2E', () => {
  test('registration ceremony stores a credential (SecurityPanel)', async ({ page, context }) => {
    const MNEMONIC = process.env.ZION_WALLET_MNEMONIC;
    test.skip(!MNEMONIC, 'No ZION_WALLET_MNEMONIC env var (real ZIS session required by /account middleware)');
    const cookie = await loginWithMnemonic(MNEMONIC!);
    await context.addCookies([cookie]);

    const { client, authenticatorId } = await addVirtualAuthenticator(page);

    const stored: Array<{ id: string; label?: string }> = [];
    await mockSecurityPanelApis(page);

    let verifyPayload: Record<string, unknown> | null = null;

    await page.route('**/api/auth/webauthn/register/options', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ceremonyId: 'e2e-reg-1', options: creationOptionsJSON() }),
      }),
    );
    await page.route('**/api/auth/webauthn/register/verify', async (route) => {
      verifyPayload = route.request().postDataJSON();
      const cred = { id: 'pk-e2e-1', label: 'E2E key', createdAt: new Date().toISOString() };
      stored.push(cred);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ credential: cred }) });
    });
    await page.route('**/api/auth/webauthn/credentials', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ credentials: stored }),
      }),
    );

    await page.goto('/account');
    await page.getByRole('button', { name: /security|bezpečnost/i }).first().click();

    const addBtn = page.getByRole('button', { name: /add passkey|přidat přístupový klíč/i });
    const visible = await addBtn.first().waitFor({ state: 'visible', timeout: 8_000 }).then(() => true).catch(() => false);
    test.skip(!visible, 'passkey UI not enabled in this build (NEXT_PUBLIC_PASSKEY_ENABLED)');

    const labelInput = page.getByPlaceholder(/label|popis/i);
    if (await labelInput.count()) await labelInput.first().fill('E2E key');
    await addBtn.click();

    // The panel re-lists credentials after verify — the stored key must appear.
    await expect(page.getByText('pk-e2e-1').or(page.getByText('E2E key')).first()).toBeVisible({ timeout: 10_000 });

    // Contract: verify payload carries ceremonyId + a real attestation response.
    expect(verifyPayload).not.toBeNull();
    const payload = verifyPayload as unknown as { ceremonyId?: string; response?: { id?: string; response?: { attestationObject?: string; clientDataJSON?: string } } };
    expect(payload.ceremonyId).toBe('e2e-reg-1');
    expect(payload.response?.response?.attestationObject).toBeTruthy();
    expect(payload.response?.response?.clientDataJSON).toBeTruthy();

    // The virtual authenticator must now hold a resident credential for this rpId.
    const { credentials } = await client.send('WebAuthn.getCredentials', { authenticatorId });
    expect(credentials.length).toBe(1);
  });

  test('login ceremony authenticates via the /login passkey button', async ({ page }) => {
    const { authenticatorId } = await addVirtualAuthenticator(page);
    const client = await page.context().newCDPSession(page);

    await mockSession(page, false);

    let loginVerifyPayload: Record<string, unknown> | null = null;
    let verified = false;
    await page.route('**/api/auth/webauthn/login/options', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ceremonyId: 'e2e-login-1', options: requestOptionsJSON() }),
      }),
    );
    await page.route('**/api/auth/webauthn/login/verify', async (route) => {
      loginVerifyPayload = route.request().postDataJSON();
      verified = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });
    // After verifyPasskeyLogin the app refetches /api/auth/me → flip to signed-in.
    await page.unroute('**/api/auth/me');
    await page.route('**/api/auth/me', (route) => {
      const authed = verified;
      return route.fulfill({
        status: authed ? 200 : 401,
        contentType: 'application/json',
        body: authed ? JSON.stringify(TEST_USER) : JSON.stringify({ error: 'unauthenticated' }),
      });
    });
    await page.route('**/api/auth/webauthn/login/verify', async (route) => {
      loginVerifyPayload = route.request().postDataJSON();
      verified = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    await page.goto('/login');

    // Seed a resident credential in the authenticator for rpId=localhost.
    await page.evaluate(async (opts: ReturnType<typeof creationOptionsJSON>) => {
      const b64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
      const cred = await navigator.credentials.create({
        publicKey: {
          challenge: b64(opts.challenge),
          rp: { name: opts.rp.name, id: opts.rp.id },
          user: { id: b64(opts.user.id), name: opts.user.name, displayName: opts.user.displayName },
          pubKeyCredParams: opts.pubKeyCredParams.map((p) => ({ type: p.type as 'public-key', alg: p.alg })),
          authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
        },
      });
      if (!cred) throw new Error('authenticator did not create a credential');
    }, creationOptionsJSON());

    const { credentials } = await client.send('WebAuthn.getCredentials', { authenticatorId });
    expect(credentials.length).toBe(1);

    const passkeyBtn = page.getByRole('button', { name: /sign in with passkey|přístupovým klíčem/i });
    const btnVisible = await passkeyBtn.first().waitFor({ state: 'visible', timeout: 8_000 }).then(() => true).catch(() => false);
    test.skip(!btnVisible, 'passkey UI not enabled in this build');
    await passkeyBtn.first().click();

    // Signed-in state: login page redirects or shows the user — wait for /me to turn.
    await expect(async () => {
      const payload = loginVerifyPayload as { ceremonyId?: string; response?: { response?: { authenticatorData?: string; signature?: string } } } | null;
      expect(payload?.ceremonyId).toBe('e2e-login-1');
      expect(payload?.response?.response?.authenticatorData).toBeTruthy();
      expect(payload?.response?.response?.signature).toBeTruthy();
    }).toPass({ timeout: 10_000 });
  });

  test('delete removes a registered passkey', async ({ page, context }) => {
    const MNEMONIC = process.env.ZION_WALLET_MNEMONIC;
    test.skip(!MNEMONIC, 'No ZION_WALLET_MNEMONIC env var (real ZIS session required by /account middleware)');
    const cookie = await loginWithMnemonic(MNEMONIC!);
    await context.addCookies([cookie]);

    await addVirtualAuthenticator(page);
    await mockSecurityPanelApis(page);

    const cred = { id: 'pk-del-1', label: 'To delete', createdAt: '2026-10-21T00:00:00Z' };
    const store = [cred];
    let deletedId: string | null = null;

    await page.route('**/api/auth/webauthn/credentials', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ credentials: deletedId ? [] : store }),
      }),
    );
    await page.route('**/api/auth/webauthn/credentials/*', (route) => {
      if (route.request().method() === 'DELETE') {
        deletedId = route.request().url().split('/').pop() ?? null;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      }
      return route.fallback();
    });

    await page.goto('/account');
    await page.getByRole('button', { name: /security|bezpečnost/i }).first().click();

    const row = page.getByText('To delete');
    const rowVisible = await row.first().waitFor({ state: 'visible', timeout: 8_000 }).then(() => true).catch(() => false);
    test.skip(!rowVisible, 'passkey UI not enabled in this build');

    // Delete is a two-step confirm in the panel.
    const delBtn = page.getByRole('button', { name: /delete|smazat/i }).last();
    await delBtn.click();
    const confirm = page.getByRole('button', { name: /confirm delete|potvrdit/i });
    if (await confirm.count()) await confirm.first().click();

    await expect(async () => {
      expect(deletedId).toBe('pk-del-1');
      await expect(page.getByText('To delete')).toHaveCount(0);
    }).toPass({ timeout: 10_000 });
  });
});
