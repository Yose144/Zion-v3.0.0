import { test, expect } from '@playwright/test';

const TEST_MINER = 'zion1g5u0m3j5x5w2t730c8s4h4m5a5v4a7p6p0c07y7';

test.describe('miner stats page', () => {
  test('renders miner address and basic structure', async ({ page }) => {
    page.on('console', (msg) => console.log(`[PAGE CONSOLE ${msg.type()}]`, msg.text()));
    page.on('pageerror', (err) => console.log('[PAGE ERROR]', err.message));
    const minerResponse = page.waitForResponse(
      (res) => res.url().includes(`/api/pool/miner/${TEST_MINER}`) && res.status() === 200,
      { timeout: 30_000 }
    );
    await page.goto(`/pool/miner/${TEST_MINER}`);
    await expect(page).toHaveTitle(/Miner/i);
    await minerResponse;
    // Wait for the dashboard to render after data fetch (Czech or English label)
    await expect(page.locator('body')).toHaveText(/hashrate|Hashrate|Výkon/i, { timeout: 30_000 });
    // Page shortens the address (zion1g5u0m3j5…6p0c07y7)
    await expect(page.locator('body')).toHaveText(new RegExp(TEST_MINER.slice(0, 12)));
  });

  test('displays payout history with normalized ZION amounts', async ({ page }) => {
    const minerResponse = page.waitForResponse(
      (res) => res.url().includes(`/api/pool/miner/${TEST_MINER}`) && res.status() === 200,
      { timeout: 30_000 }
    );
    await page.goto(`/pool/miner/${TEST_MINER}`);
    await minerResponse;
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toHaveText(/hashrate|Hashrate|Výkon/i, { timeout: 30_000 });

    const bodyText = await page.locator('body').innerText();

    // Page should contain payout-related text and at least one ZION amount
    expect(bodyText).toMatch(/ZION/i);
    expect(bodyText).toMatch(/payout|vyplaceno|paid/i);

    // Amounts should be formatted as decimal ZION (e.g. 3307596.4799 ZION),
    // not raw atomic integers. Verify a decimal ZION amount is present.
    expect(bodyText).toMatch(/\d{1,3}(?:,\d{3})*\.\d{2,6}\s*ZION/);
  });

  test('api endpoints return valid JSON', async ({ request }) => {
    const health = await request.get('/api/health');
    expect(health.ok()).toBe(true);
    const healthBody = await health.json();
    expect(healthBody.status).toBe('ok');

    const miner = await request.get(`/api/pool/miner/${TEST_MINER}`);
    expect(miner.ok()).toBe(true);
    const minerBody = await miner.json();
    expect(minerBody.ok).toBe(true);
    expect(minerBody.address).toBe(TEST_MINER);

    const metrics = await request.get(`/api/pool/miner/${TEST_MINER}/metrics`);
    expect(metrics.ok()).toBe(true);
    const metricsBody = await metrics.json();
    expect(metricsBody.ok).toBe(true);
  });
});
