import { chromium } from 'playwright';

const base = 'http://127.0.0.1:3123';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});

await page.goto(base + '/zion-archive', { waitUntil: 'networkidle', timeout: 180000 });
await page.evaluate(async (code) => {
  await fetch('/api/archive/access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
}, 'ZAP-TEST-LOCAL-1234');
await page.goto(base + '/zion-archive', { waitUntil: 'networkidle', timeout: 180000 });

// create progress + bookmark
await page.goto(base + '/zion-archive/nirvana/cist#01-Prvni-Paprsek', { waitUntil: 'networkidle', timeout: 180000 });
await page.waitForTimeout(1500);
console.log('fresh deep-link heading:', (await page.locator('h2').first().innerText()).trim());
console.log('fresh deep-link progress:', await page.evaluate(() => localStorage.getItem('zion.archive.progress.v1')));
await page.getByRole('button', { name: /Záložka|Bookmark/ }).click();

await page.goto(base + '/zion-archive', { waitUntil: 'networkidle', timeout: 180000 });
await page.goto(base + '/zion-archive#moje', { waitUntil: 'networkidle', timeout: 180000 });
await page.waitForTimeout(900);
const panel = page.locator('section[data-panel="moje"]');
console.log('moje visible:', await panel.isVisible());
console.log('pass label:', await panel.getByText(/ZION Pass ·/).count());
const readingSection = panel.locator('div.space-y-3').first();
console.log('reading item:', await readingSection.getByText('NIRVANA').count());
console.log('reading empty:', await panel.getByText(/Zatím nic rozečtené/).count());
console.log('bookmarks:', await panel.getByText(/Záložky · 1/).count());
console.log('links:', await panel.locator('a[href="#stazeni"], a[href="#knihovna"]').count());
await page.screenshot({ path: '/tmp/archive-moje.png', fullPage: true });

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await mobile.addCookies(await ctx.cookies());
const mp = await mobile.newPage();
mp.on('pageerror', (e) => errors.push('mobile: ' + e.message));
await mp.goto(base + '/zion-archive#moje', { waitUntil: 'networkidle', timeout: 180000 });
await mp.waitForTimeout(700);
console.log('mobile overflow:', await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));
await mp.screenshot({ path: '/tmp/archive-moje-mobile.png', fullPage: true });

console.log('errors:', errors.length ? errors : 'none');
await browser.close();
