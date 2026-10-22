import { test, expect } from '@playwright/test';

test.describe('/wallet/multichain page', () => {
  test('renders the multichain wallet view and sign-in prompt', async ({ page }) => {
    page.on('console', (msg) => console.log(`[PAGE CONSOLE ${msg.type()}]`, msg.text()));
    page.on('pageerror', (err) => console.log('[PAGE ERROR]', err.message));

    await page.goto('/wallet/multichain');

    await expect(page).toHaveTitle(/Multichain Wallet|Wallet/i);

    const body = page.locator('body');
    await expect(body).toHaveText(/Multichain Wallet/i, { timeout: 30_000 });
    await expect(body).toHaveText(/sign in|Přihlaste se/i, { timeout: 10_000 });
  });

  test('sign-in prompt links to the login page', async ({ page }) => {
    await page.goto('/wallet/multichain');

    const signInLink = page.getByRole('link', { name: /sign in|Přihlaste se|Sign In/i });
    await expect(signInLink).toBeVisible({ timeout: 10_000 });

    await signInLink.click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('navigation from /wallet to multichain wallet works', async ({ page }) => {
    await page.goto('/wallet');

    const multichainLink = page.getByRole('link', { name: /Otevřít multichain peněženku|Open multichain wallet/i });
    await expect(multichainLink).toBeVisible({ timeout: 10_000 });

    await multichainLink.click();
    await expect(page).toHaveURL(/\/wallet\/multichain/);
    await expect(page.locator('body')).toHaveText(/Multichain Wallet/i, { timeout: 10_000 });
  });
});
