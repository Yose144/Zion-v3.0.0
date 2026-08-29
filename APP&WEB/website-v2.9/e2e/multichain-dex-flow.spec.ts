import { test, expect } from '@playwright/test';

test.describe('Multichain /dex swap widget', () => {
  const TEST_USER = {
    id: 'dex-user-001',
    primaryAddress: '0xDexUserPrimary',
    displayName: 'Dex Test User',
    email: null,
    avatar: null,
    bio: null,
    role: 'user',
    createdAt: '2026-08-27T00:00:00Z',
    lastLogin: '2026-08-27T00:00:00Z',
    loginCount: 1,
    linkedAddresses: [
      {
        id: 'la-dex-1',
        userId: 'dex-user-001',
        address: '0xDexUserPrimary',
        chainType: 'evm',
        chainId: 'base',
        verifiedAt: '2026-08-27T00:00:00Z',
      },
    ],
    oasisPlayer: null,
  };

  // 100 wZION (18 decimals) in; 90 USDT (6 decimals) out.
  const AMOUNT_IN_ATOMIC = '100000000000000000000';
  const EXPECTED_OUT_ATOMIC = '90000000';
  const SLIPPAGE_BPS = 200;
  const MIN_OUT_ATOMIC = String(
    (BigInt(EXPECTED_OUT_ATOMIC) * BigInt(10000 - SLIPPAGE_BPS)) / BigInt(10000),
  );

  test.use({ locale: 'en-US' });

  test('gets quote and executes a same-chain wZION → USDC swap with mocked APIs', async ({ page }) => {
    page.on('pageerror', (err) => console.log('[PAGE ERROR]', err.message, err.stack));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('[PAGE CONSOLE ERROR]', msg.text());
    });

    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(TEST_USER),
      });
    });

    await page.route('**/api/swap/quote/multi', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          routes: [
            {
              route: [
                { chain: 'base', contract: '0xWZION', ticker: 'wZION' },
                { chain: 'base', contract: '0xUSDT', ticker: 'USDT' },
              ],
              expected_out: EXPECTED_OUT_ATOMIC,
              slippage_bps: SLIPPAGE_BPS,
              total_fee_bps: 30,
            },
          ],
        }),
      });
    });

    let executeBody: any = null;
    await page.route('**/api/swap/execute-v2', async (route) => {
      executeBody = await route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          amount_out: MIN_OUT_ATOMIC,
          tx_hash: '0xSwapTxHash',
        }),
      });
    });

    await page.goto('/multichain#dex');

    await test.step('widget loads and fetches quote', async () => {
      await expect(page.getByRole('heading', { name: /ZionDex Swap/i })).toBeVisible({ timeout: 15_000 });

      const amountInput = page.locator('input[type="number"]');
      await amountInput.fill('100');

      // Wait for quote API to be called and the quote state to render.
      await expect(async () => {
        expect(executeBody).toBeNull(); // execute not called yet
      }).toPass({ timeout: 5_000 });

      await expect(page.getByText(new RegExp(`Min: ${Number(MIN_OUT_ATOMIC) / 1e6}`))).toBeVisible({ timeout: 15_000 });
    });

    await test.step('execute same-chain swap', async () => {
      const swapButton = page.locator('button.zion-button-primary:has-text("Swap")');
      await expect(swapButton).toBeEnabled({ timeout: 10_000 });
      await swapButton.click();

      await expect(page.getByText(/Swap executed/i)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(new RegExp(`Output: ${MIN_OUT_ATOMIC}`))).toBeVisible({ timeout: 10_000 });

      expect(executeBody).toMatchObject({
        from: { id: { chain: 'base', ticker: 'wZION' } },
        to: { id: { chain: 'base', ticker: 'USDT' } },
        amount: Number(AMOUNT_IN_ATOMIC),
        min_amount_out: Number(MIN_OUT_ATOMIC),
      });
    });
  });
});
