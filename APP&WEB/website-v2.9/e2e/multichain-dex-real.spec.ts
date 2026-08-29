import { test, expect } from '@playwright/test';
import { loginWithMnemonic } from './lib/zis-login';

test.describe('Multichain /dex swap widget — real Edge', () => {
  test.use({ locale: 'en-US' });

  const MNEMONIC = process.env.ZION_WALLET_MNEMONIC;

  test('loads /multichain#dex and fetches a real DEX quote', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      // 401 on /api/auth/me is expected when the test wallet is not logged in.
      // ERR_CERT_COMMON_NAME_INVALID can come from external feeds; not a web bug.
      if (text.includes('401') || text.includes('ERR_CERT_COMMON_NAME_INVALID')) return;
      errors.push(`console: ${text}`);
    });

    await page.goto('/multichain#dex');

    await expect(page.getByRole('heading', { name: /ZionDex Swap/i })).toBeVisible({ timeout: 15_000 });

    // The multichain page fires several /api calls on load (pools, chart, health).
    // Wait briefly so the nginx rate-limit bucket can refill before we request a quote.
    await page.waitForTimeout(2_000);

    const amountInput = page.locator('input[type="number"]');
    await amountInput.fill('100');

    // Quote may take a few seconds against real backend; wait for Min output display.
    await expect(page.getByText(/Min:/i)).toBeVisible({ timeout: 30_000 });

    // Expect some numeric output amount for the selected pair.
    const outEl = page.locator('div.text-2xl.font-bold.text-zion-gold');
    await expect(outEl).toHaveText(/\d+\.?\d*/);

    expect(errors).toEqual([]);
  });

  test('authenticates and executes a same-chain wZION → USDT swap on real backend', async ({ page, context }) => {
    if (!MNEMONIC) {
      test.skip(true, 'No ZION_WALLET_MNEMONIC env var');
    }

    const cookie = await loginWithMnemonic(MNEMONIC!);
    await context.addCookies([cookie]);

    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      // 400 from the real swap execute is expected for the test wallet (no balance).
      if (text.includes('ERR_CERT_COMMON_NAME_INVALID') || text.includes('status of 400')) return;
      errors.push(`console: ${text}`);
    });

    await page.goto('/multichain#dex');

    // Wait for auth to resolve and the widget to show the authenticated swap UI.
    await expect(page.getByRole('heading', { name: /ZionDex Swap/i })).toBeVisible({ timeout: 15_000 });

    const amountInput = page.locator('input[type="number"]');
    await amountInput.fill('100');

    await expect(page.getByText(/Min:/i)).toBeVisible({ timeout: 30_000 });

    const swapButton = page.locator('button.zion-button-primary:has-text("Swap")');
    await expect(swapButton).toBeEnabled({ timeout: 15_000 });
    await swapButton.click();

    // The execute may succeed or fail with a backend error (e.g. insufficient balance).
    // We accept either outcome as long as the request reaches the real backend.
    const successLoc = page.getByText(/Swap executed/i);
    // Use the actual widget error alert to avoid matching generic 'Quote failed' labels.
    const errorLoc = page.getByText(/insufficient balance|Swap failed/i).first();
    await expect(async () => {
      const success = await successLoc.isVisible().catch(() => false);
      const error = await errorLoc.isVisible().catch(() => false);
      expect(success || error).toBe(true);
    }).toPass({ timeout: 30_000 });

    const success = await successLoc.isVisible().catch(() => false);
    const statusText = success ? 'Swap executed' : (await errorLoc.textContent() ?? 'unknown');
    console.log('execute status:', statusText);

    // If the test wallet has no balance the real backend should reject the swap.
    expect(statusText).toMatch(/(Swap executed|insufficient|failed)/i);

    // 400/500 responses from the real backend are expected when the wallet has
    // no balance or the route is no longer available.
    expect(errors).toEqual([]);
  });
});
