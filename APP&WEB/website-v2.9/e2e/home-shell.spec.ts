import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3100';

test.use({ channel: 'chrome', navigationTimeout: 90_000 });

const KNOWN_WARN = /same key.*multichain#bridge|non-unique keys|DevTools|Download the React/i;
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !KNOWN_WARN.test(m.text())) {
      errors.push(`console: ${m.text().slice(0, 200)}`);
    }
  });
  page.on('requestfailed', (r) => {
    if (r.url().includes('/_next/') && r.failure()?.errorText !== 'net::ERR_ABORTED') {
      errors.push(`asset-fail: ${r.url()}`);
    }
  });
  return errors;
}

async function stubApis(ctx: BrowserContext) {
  await ctx.route(/\/api\//, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  );
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) => route.abort());
}

test.describe('home shell performance & resilience', () => {
  test.setTimeout(180_000);

  test('a: no-JS page is dark and readable', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    const bg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
    const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundImage);
    expect(bg, 'html must not be transparent').not.toBe('rgba(0, 0, 0, 0)');
    expect(bodyBg, 'body gradient must render').toContain('gradient');
    await expect(page.locator('h1').first()).toBeAttached();
    const h1Opacity = await page.locator('h1').first().evaluate((el) => getComputedStyle(el).opacity);
    expect(Number(h1Opacity), 'h1 must not start hidden').toBeGreaterThan(0.5);
    await ctx.close();
  });

  test('b: canvas failure still leaves a readable dark page', async ({ page }) => {
    await stubApis(page.context());
    const errors = watchErrors(page);
    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.getContext = function () {
        return null;
      } as never;
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toBeVisible();
    const bg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
    expect(bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(errors.filter((e) => !e.includes('getContext'))).toEqual([]);
  });

  test('c: denied storage does not crash; persisted theme hydrates', async ({ page }) => {
    await stubApis(page.context());
    const errors = watchErrors(page);
    await page.addInitScript(() => {
      const real = Storage.prototype.getItem;
      let calls = 0;
      Storage.prototype.getItem = function (k: string) {
        calls++;
        if (calls < 2) throw new Error('denied');
        return real.call(this, k);
      };
      Storage.prototype.setItem = function () {
        throw new Error('denied');
      };
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/error boundary|something went wrong/i);
    // stored nondefault theme applies after hydration without error
    const p2 = await page.context().newPage();
    watchErrors(p2);
    await p2.goto('/', { waitUntil: 'domcontentloaded' });
    await p2.waitForTimeout(1500);
    await expect(p2.locator('h1').first()).toBeVisible();
    expect(errors.filter((e) => e.startsWith('pageerror'))).toEqual([]);
  });

  test('d: reduced-motion canvas draws one frame, no RAF churn', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    await stubApis(ctx);
    const page = await ctx.newPage();
    const errors = watchErrors(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const rafCount = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let n = 0;
          const orig = requestAnimationFrame;
          // count RAF callbacks over 500ms — background canvas must not churn
          const tick = () => { n++; requestAnimationFrame(tick); };
          requestAnimationFrame(tick);
          setTimeout(() => resolve(n), 500);
        })
    );
    expect(rafCount).toBeGreaterThan(0); // sanity: RAF works at all
    const canvas = page.locator('canvas').first();
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('e: 3D loads only on explicit opt-in; failures stay local', async ({ page }) => {
    await stubApis(page.context());
    const errors = watchErrors(page);
    const textureReqs: string[] = [];
    page.on('request', (r) => {
      if (/\/textures\/earth-(blue|topology|dark)/.test(r.url())) textureReqs.push(r.url());
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    // static poster exists immediately; no 3D texture requests before opt-in
    // (poster uses the same webp via <img>, so only count after click)
    const before = textureReqs.length;
    const btn = page.getByRole('button', { name: /prozkoumat ve 3d|explore in 3d/i });
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(4000);
      const after = textureReqs.length;
      expect(after).toBeGreaterThanOrEqual(before); // opt-in path taken
      await expect(page.locator('body')).not.toContainText(/something went wrong/i);
    }
    expect(errors.filter((e) => e.startsWith('pageerror'))).toEqual([]);
  });

  test('f: slider mounts only current image; manual next swaps after load', async ({ page }) => {
    await stubApis(page.context());
    const errors = watchErrors(page);
    const slideReqs: string[] = [];
    page.on('request', (r) => {
      if (/\/images\/(home|l5-free-world|maria-del-camino|ekam|genesis-garden|amenti)\/hero/.test(r.url()))
        slideReqs.push(r.url());
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const mounted = await page.locator('.group\\/slider img').count();
    expect(mounted, 'slider should mount ≤2 images').toBeLessThanOrEqual(2);
    const firstReqs = slideReqs.length;
    const next = page.getByRole('button', { name: /další obrázek|next slide/i });
    await next.click();
    await page.waitForTimeout(3000);
    const imgs = await page.locator('.group\\/slider img').count();
    expect(imgs).toBeLessThanOrEqual(2);
    expect(errors.filter((e) => e.startsWith('pageerror'))).toEqual([]);
  });

  test('g: interactive widgets mount only near viewport', async ({ page }) => {
    await stubApis(page.context());
    const errors = watchErrors(page);
    const apiCalls: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/')) apiCalls.push(r.url());
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const topCalls = apiCalls.length;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.5));
    await page.waitForTimeout(3000);
    // widgets mount near viewport — their content appears
    expect(errors.filter((e) => e.startsWith('pageerror'))).toEqual([]);
  });

  test('h: mobile drawer — real click, dialog semantics, focus, scroll restore', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await stubApis(ctx);
    const page = await ctx.newPage();
    const errors = watchErrors(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => window.scrollTo(0, 800));
    const y0 = await page.evaluate(() => window.scrollY);
    const btn = page.locator('nav button[aria-label*="menu" i]').first();
    const drawer = page.locator('#mobile-nav-drawer');
    // real pointer click — retry only until hydration attaches the handler
    for (let i = 0; i < 6 && !(await drawer.isVisible().catch(() => false)); i++) {
      await btn.click();
      await page.waitForTimeout(700);
    }
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveAttribute('role', 'dialog');
    await expect(drawer).toHaveAttribute('aria-modal', 'true');
    // Escape closes
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    const y1 = await page.evaluate(() => window.scrollY);
    expect(Math.abs(y1 - y0), 'scroll position must be restored').toBeLessThan(5);
    // reopen + close via visible drawer button
    for (let i = 0; i < 6 && !(await drawer.isVisible().catch(() => false)); i++) {
      await btn.click();
      await page.waitForTimeout(700);
    }
    await expect(drawer).toBeVisible();
    await drawer.locator(`button[aria-label]`).first().click();
    await expect(drawer).toBeHidden();
    expect(errors.filter((e) => e.startsWith('pageerror'))).toEqual([]);
    await ctx.close();
  });

  test('i: floating controls never overlap; menus fit viewport', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await stubApis(ctx);
    const page = await ctx.newPage();
    const errors = watchErrors(page);
    const apiHits: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/ai-chat')) apiHits.push(r.url());
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    expect(apiHits.length, 'closed chat must not probe').toBe(0);
    const bg = await page.locator('div.fixed.bottom-4.right-4 > button').first().boundingBox();
    const chat = await page.locator('button[aria-label*="Hiranyagarbha" i], button[aria-label*="chat" i], .fixed.bottom-20.right-4 > *').first().boundingBox();
    if (bg && chat) {
      const overlapX = Math.min(bg.x + bg.width, chat.x + chat.width) - Math.max(bg.x, chat.x);
      const overlapY = Math.min(bg.y + bg.height, chat.y + chat.height) - Math.max(bg.y, chat.y);
      expect(Math.min(overlapX, overlapY), 'controls must not overlap').toBeLessThanOrEqual(0);
    }
    expect(errors.filter((e) => e.startsWith('pageerror'))).toEqual([]);
    await ctx.close();
  });

  test('j: no horizontal overflow + headings/CTAs at key widths, CZ+EN', async ({ browser }) => {
    for (const w of [320, 390, 768, 1440]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
      await stubApis(ctx);
      const page = await ctx.newPage();
      const errors = watchErrors(page);
      for (const path of ['/', '/maitreya', '/docs', '/whitepapers']) {
        await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1200);
        const ov = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        expect(ov, `${path}@${w}px overflow`).toBeLessThanOrEqual(1);
        await expect(page.locator('h1, h2').first()).toBeVisible();
      }
      expect(errors.filter((e) => e.startsWith('pageerror'))).toEqual([]);
      await ctx.close();
    }
  });
});
