// Rychlá vizuální kontrola stránky avatarů (headless Chromium, GPU).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer');

const BASE = process.env.BASE ?? 'http://127.0.0.1:3032';
const OUT = process.env.OUT ?? '.artifacts/render/oasis-avatars-20261101';

const browser = await puppeteer.launch({
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal', '--hide-scrollbars'],
  defaultViewport: { width: 1440, height: 1100, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

await page.goto(`${BASE}/l4-oasis/avatars`, { waitUntil: 'networkidle2', timeout: 90_000 });
await new Promise((r) => setTimeout(r, 2500));

await page.screenshot({ path: `${OUT}/page-top.png` });

// sjeď na roster
await page.evaluate(() => {
  const heading = [...document.querySelectorAll('h2,h3')].find((el) => /Kruhy rosteru|Roster Circles/i.test(el.textContent ?? ''));
  heading?.scrollIntoView({ behavior: 'instant', block: 'start' });
});
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: `${OUT}/page-roster.png` });

// otevři detail prvního avatara
const opened = await page.evaluate(() => {
  const card = document.querySelector('button[aria-label*="—"]');
  if (!card) return false;
  card.click();
  return true;
});
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: `${OUT}/page-modal.png` });

const stats = await page.evaluate(() => ({
  cards: document.querySelectorAll('button[aria-label*="—"]').length,
  brokenImages: [...document.images].filter((img) => img.complete && img.naturalWidth === 0).map((img) => img.src),
  totalImages: document.images.length,
}));

console.log(JSON.stringify({ opened, ...stats, errors: errors.slice(0, 8) }, null, 2));
await browser.close();
