import { test, expect, request as playwrightRequest } from '@playwright/test';

// Zion Archive hub — functional coverage of the paid library.
// Requires a valid archive code in ARCHIVE_TEST_PASS (the same value as one of
// the server's ARCHIVE_PASS_CODES / a marketplace code); without it the suite
// is skipped so production runs stay green.
//
//   ARCHIVE_TEST_PASS=ZAP-... E2E_BASE_URL=http://localhost:3123 \
//     npx playwright test e2e/zion-archive-hub.spec.ts

const PASS = process.env.ARCHIVE_TEST_PASS;

test.use({ channel: 'chrome', navigationTimeout: 60_000 });

test.describe('Zion Archive hub (needs ARCHIVE_TEST_PASS)', () => {
  // Dev-server compilation + chapter fetches: run serially so parallel workers
  // do not compete for the same on-demand compile.
  test.describe.configure({ mode: 'serial' });
  test.skip(!PASS, 'ARCHIVE_TEST_PASS is not set');
  test.setTimeout(120_000);

  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([
      {
        name: 'zion_archive_pass',
        value: PASS!,
        url: baseURL!,
        httpOnly: true,
        secure: (baseURL ?? '').startsWith('https://'),
        sameSite: 'Lax',
      },
    ]);
  });

  test('hub renders, shows the pass and the library', async ({ page }) => {
    await page.goto('/zion-archive', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: /Zion Archive/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/ZION Pass ·/i).first()).toBeVisible({ timeout: 20_000 });

    await page.goto('/zion-archive#knihovna', { waitUntil: 'domcontentloaded' });
    const panel = page.locator('section[data-panel="knihovna"]');
    await expect(panel).toBeVisible({ timeout: 20_000 });
    await expect(panel.locator('article')).toHaveCount(20, { timeout: 20_000 });
  });

  test('fresh deep link opens the chapter, not the index', async ({ page }) => {
    await page.goto('/zion-archive/nirvana/cist#01-Prvni-Paprsek', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.zion-docs-prose', { timeout: 20_000 });
    await page.waitForTimeout(1200);
    expect(await page.evaluate(() => location.hash)).toBe('#01-Prvni-Paprsek');
    await expect(page.locator('h2').first()).toContainText(/První paprsek/);
    const progress = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('zion.archive.progress.v1') ?? '{}'),
    );
    expect(progress.nirvana.chapterSlug).toBe('01-Prvni-Paprsek');
  });

  test('front matter is not progress, first chapter is', async ({ page }) => {
    await page.goto('/zion-archive/nirvana/cist#00-README', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.zion-docs-prose', { timeout: 20_000 });
    await page.waitForTimeout(1200);
    expect(await page.evaluate(() => localStorage.getItem('zion.archive.progress.v1'))).toBeNull();

    await page.evaluate(() => {
      window.location.hash = '01-Prvni-Paprsek';
    });
    await page.waitForTimeout(2000);
    const progress = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('zion.archive.progress.v1') ?? '{}'),
    );
    expect(progress.nirvana.totalChapters).toBe(14);
    expect(progress.nirvana.chapterIndex).toBe(0);
  });

  test('search, bookmark and reader settings work', async ({ page }) => {
    await page.goto('/zion-archive/nirvana/cist#01-Prvni-Paprsek', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.zion-docs-prose', { timeout: 20_000 });
    await page.waitForTimeout(1000);

    // full-text search across chapters
    const search = page
      .getByRole('searchbox', { name: /Hledat v knize|Search this book/ })
      .first();
    await search.fill('Ararat');
    await expect(page.locator('ul.divide-y li button').first()).toBeVisible({ timeout: 25_000 });

    // bookmark toggle
    await page.getByRole('button', { name: /Záložka|Bookmark/ }).click();
    const bookmarks = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('zion.archive.bookmarks.v1') ?? '[]'),
    );
    expect(bookmarks).toHaveLength(1);
    await expect(page.getByText(/Záložky · 1|Bookmarks · 1/)).toBeVisible({ timeout: 10_000 });

    // reader settings
    await page.locator('button[aria-haspopup="dialog"]').click();
    await page.getByRole('button', { name: 'XL' }).click();
    await page.getByRole('button', { name: /Sépia|Sepia/ }).click();
    await expect(page.locator('.reader-theme-sepia')).toHaveCount(1, { timeout: 10_000 });
    await expect(page.locator('.zion-docs-prose.reader-size-xl')).toHaveCount(1, {
      timeout: 10_000,
    });
  });

  test('downloads panel lists the edition with a checksum', async ({ page }) => {
    await page.goto('/zion-archive#stazeni', { waitUntil: 'domcontentloaded' });
    const panel = page.locator('section[data-panel="stazeni"]');
    await expect(panel).toBeVisible({ timeout: 20_000 });
    await expect(panel.locator('article')).toHaveCount(1, { timeout: 20_000 });
    await expect(panel).toContainText(/SHA-256/i);
    await expect(
      panel.locator('a[href="/api/archive/downloads/kralovstvi-srdce-bundle"]'),
    ).toBeVisible();
  });
});

test.describe('Zion Archive downloads gate (no pass)', () => {
  test('anonymous 403, unknown slug 404', async ({}, testInfo) => {
    // Dedicated context: never inherits the pass cookie from other tests.
    const anon = await playwrightRequest.newContext({
      baseURL: testInfo.project.use.baseURL ?? 'http://localhost:3000',
    });
    try {
      const file = await anon.get('/api/archive/downloads/kralovstvi-srdce-bundle', {
        maxRedirects: 0,
      });
      expect(file.status()).toBe(403);

      const unknown = await anon.get('/api/archive/downloads/does-not-exist', {
        maxRedirects: 0,
      });
      expect(unknown.status()).toBe(404);
    } finally {
      await anon.dispose();
    }
  });
});
