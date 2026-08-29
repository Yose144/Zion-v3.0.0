import { test, expect } from '@playwright/test';

test.describe('Multichain deposit → withdraw E2E (mocked APIs)', () => {
  const TEST_USER = 'test-user-flow-001';
  const ZION_DEPOSIT_AMOUNT = '100000000'; // 100 ZION, 6 decimals
  const WITHDRAW_ZION = '90000000'; // 90 ZION
  const REMAINING_ZION = String(BigInt(ZION_DEPOSIT_AMOUNT) - BigInt(WITHDRAW_ZION));
  const RECIPIENT = 'zion1WithdrawRecipient';
  const DEPOSIT_TX = '0xDepositTxFlow';
  const WITHDRAWAL_ID = 'wd-flow-001';
  const DERIVED_ADDRESS = 'zion1DerivedDepositAddress';

  const user = {
    id: TEST_USER,
    primaryAddress: 'zion1flowtest',
    displayName: 'Flow Test User',
    email: null,
    avatar: null,
    bio: null,
    role: 'user',
    createdAt: '2026-08-27T00:00:00Z',
    lastLogin: '2026-08-27T00:00:00Z',
    loginCount: 1,
    linkedAddresses: [
      {
        id: 'la-flow-1',
        userId: TEST_USER,
        address: '0xFlowLinkedEvm',
        chainType: 'evm',
        chainId: 'base',
        verifiedAt: '2026-08-27T00:00:00Z',
      },
      {
        id: 'la-flow-2',
        userId: TEST_USER,
        address: 'zion1flowtest',
        chainType: 'zion-l1',
        chainId: null,
        verifiedAt: '2026-08-27T00:00:00Z',
      },
    ],
    oasisPlayer: null,
  };

  const baseWalletSnapshot = {
    user_id: TEST_USER,
    addresses: [
      {
        address: { encoded: 'zion1FlowDeposit', bytes: '0x00' },
        user_id: TEST_USER,
        chain: 'zion',
        chain_id: null,
        purpose: 'deposit',
        public_key: null,
        derivation_path: "m/44'/9999'/0'/0/0",
        is_external: false,
        created_at: '2026-08-27T00:00:00Z',
      },
    ],
    balances: [
      { asset_key: 'zion:ZION', amount: ZION_DEPOSIT_AMOUNT },
    ],
    deposits: [
      {
        id: 'dep-flow-001',
        user_id: TEST_USER,
        chain: 'zion',
        chain_id: null,
        tx_hash: DEPOSIT_TX,
        asset_key: 'zion:ZION',
        amount: ZION_DEPOSIT_AMOUNT,
        confirmations: 12,
        status: 'credited',
        created_at: '2026-08-27T00:00:00Z',
        credited_at: '2026-08-27T00:00:00Z',
      },
    ],
    withdrawals: [],
    orders: [],
  };

  const postWithdrawSnapshot = {
    ...baseWalletSnapshot,
    balances: [
      { asset_key: 'zion:ZION', amount: REMAINING_ZION },
    ],
    withdrawals: [
      {
        id: WITHDRAWAL_ID,
        user_id: TEST_USER,
        asset_key: 'zion:ZION',
        amount: WITHDRAW_ZION,
        recipient_address: RECIPIENT,
        tx_hash: null,
        status: 'pending',
        created_at: '2026-08-27T00:00:00Z',
        sent_at: null,
      },
    ],
  };

  test.use({ locale: 'en-US' });

  test('full flow: derive deposit address and withdraw deposited ZION with mocked backend', async ({ page }) => {
    const mockState = {
      stage: 'pre-withdraw' as 'pre-withdraw' | 'post-withdraw',
      walletCallCount: 0,
      derived: null as { chain: string; address: string; bytes?: string } | null,
    };

    const walletSnapshot = () =>
      mockState.stage === 'post-withdraw' ? postWithdrawSnapshot : baseWalletSnapshot;

    await page.addInitScript(() => {
      window.localStorage.setItem('zion-lang', 'en');
    });

    page.on('pageerror', (err) => console.log('[PAGE ERROR]', err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('[PAGE CONSOLE ERROR]', msg.text());
    });

    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(user),
      });
    });

    await page.route('**/api/multichain/wallet/me', async (route) => {
      mockState.walletCallCount += 1;
      const snapshot = structuredClone(walletSnapshot());
      if (mockState.derived && mockState.walletCallCount > 1) {
        snapshot.addresses.push({
          address: { encoded: mockState.derived.address, bytes: mockState.derived.bytes ?? '0x00' },
          user_id: TEST_USER,
          chain: mockState.derived.chain,
          chain_id: null,
          purpose: 'deposit',
          public_key: null,
          derivation_path: "m/44'/9999'/0'/0/0",
          is_external: false,
          created_at: '2026-08-27T00:00:00Z',
        });
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(snapshot),
      });
    });

    await page.route('**/api/multichain/wallet/derive', async (route) => {
      const body = await route.request().postDataJSON();
      mockState.derived = {
        chain: body?.chain ?? 'zion',
        address: DERIVED_ADDRESS,
        bytes: '0x00',
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockState.derived),
      });
    });

    await page.route('**/api/multichain/wallet/withdraw', async (route) => {
      const body = await route.request().postDataJSON();
      mockState.stage = 'post-withdraw';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          withdrawal_id: WITHDRAWAL_ID,
          status: 'pending',
          asset: body?.asset,
          amount: body?.amount,
          recipient: body?.recipient,
        }),
      });
    });

    await page.goto('/wallet/multichain');

    await expect(page.getByText('Manage your multichain assets and swaps in one place.')).toBeVisible({ timeout: 15_000 });

    await test.step('derive a new deposit address', async () => {
      const deriveSelect = page.locator('select').first();
      await deriveSelect.selectOption('zion');
      await page.getByRole('button', { name: /Generate address/i }).click();
      await expect(page.getByText(new RegExp(`Address generated: ${DERIVED_ADDRESS}`))).toBeVisible({ timeout: 10_000 });
    });

    await test.step('refresh wallet and see the deposit credited', async () => {
      await page.getByRole('button', { name: /Refresh/i }).first().click();
      await expect(page.getByText(DERIVED_ADDRESS, { exact: true }).first()).toBeVisible({ timeout: 10_000 });
      await page.getByRole('button', { name: /Deposits/i }).click();
      await expect(page.getByText(DEPOSIT_TX)).toBeVisible({ timeout: 10_000 });
      await page.getByRole('button', { name: /Overview/i }).click();
      await expect(page.getByText('zion:ZION')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText('100', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    });

    await test.step('withdraw the deposited ZION', async () => {
      await page.getByRole('button', { name: /New withdrawal/i }).click();

      const inputs = page.locator('form input[type="text"]');
      await inputs.nth(0).fill('zion:ZION');
      await inputs.nth(1).fill(WITHDRAW_ZION);
      await inputs.nth(2).fill(RECIPIENT);

      await page.getByRole('button', { name: /^Submit$/i }).click();

      // Success refreshes the wallet and closes the form.
      await expect(page.getByRole('button', { name: /New withdrawal/i })).toBeVisible({ timeout: 15_000 });
      await page.getByRole('button', { name: /Withdrawals/i }).click();
      await expect(page.getByText('zion:ZION: 90').first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(RECIPIENT).first()).toBeVisible({ timeout: 10_000 });

      // Balance should now show the remaining 10 ZION.
      await page.getByRole('button', { name: /Overview/i }).click();
      await expect(page.getByText('zion:ZION')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText('10', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    });
  });
});
