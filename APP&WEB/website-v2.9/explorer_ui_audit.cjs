const { chromium } = require('playwright');

const BASE = 'https://app.zionterranova.com';
const PAGES = [
  '/explorer', '/explorer/transactions', '/explorer/blocks', '/explorer/block?height=2699',
  '/explorer/tx?hash=88028435cf9f23ad319dc4ec98f949db6216d2f4fdee0351cf5fadc5acd06b85',
  '/explorer/address?address=zion1n4k4n5e4p0z3g7z2e0z0j7c8w7y0v5m8c6hf8c2',
  '/explorer/mempool', '/explorer/search', '/explorer/charts', '/explorer/emission',
  '/explorer/supply', '/explorer/consensus', '/explorer/network-stats', '/explorer/richlist',
  '/explorer/miners', '/explorer/bridge', '/explorer/broadcast', '/explorer/fee-estimator',
  '/explorer/verify-message', '/explorer/status', '/explorer/txs',
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const issues = [];
  for (const p of PAGES) {
    const consoleErrors = [];
    const routeErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push(err.message));
    page.on('response', res => {
      if (res.status() >= 400) routeErrors.push(`${res.status()} ${res.url()}`);
    });
    try {
      await page.goto(`${BASE}${p}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(4000);
      const title = await page.title().catch(() => '');
      const notFound = await page.locator('text=Not Found').first().isVisible().catch(() => false);
      const error = await page.locator('text=Failed to load').first().isVisible().catch(() => false);
      if (notFound) issues.push(`${p}: Not Found visible`);
      if (error) issues.push(`${p}: Failed to load visible`);
      if (consoleErrors.length) issues.push(`${p}: console errors: ${consoleErrors.slice(0,3).join('; ')}`);
      if (routeErrors.length) issues.push(`${p}: route errors: ${routeErrors.slice(0,3).join('; ')}`);
      const safe = p.replace(/[^a-z0-9_-]/gi, '_');
      await page.screenshot({ path: `/tmp/explorer_${safe}.png`, fullPage: true }).catch(() => {});
      console.log(`${p}: title="${title}" errors=${consoleErrors.length} routeErrors=${routeErrors.length}`);
    } catch (e) {
      issues.push(`${p}: navigation error ${e.message}`);
      console.log(`${p}: NAV ERROR ${e.message}`);
    }
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
    page.removeAllListeners('response');
    await sleep(2000);
  }
  await browser.close();
  if (issues.length) {
    console.log('\nISSUES:');
    issues.forEach(i => console.log(` - ${i}`));
    process.exit(1);
  } else {
    console.log('\nALL UI CHECKS PASSED');
  }
})();
