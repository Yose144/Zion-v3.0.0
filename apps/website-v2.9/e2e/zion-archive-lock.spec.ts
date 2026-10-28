import { test, expect } from '@playwright/test';

// Zion Archive — Nirvana Hub is locked (coming-soon gate). While ARCHIVE_LOCKED
// is true every route under /zion-archive renders the lock page, and /maitreya
// permanent-redirects to the new canonical tree.
test.use({ channel: 'chrome', navigationTimeout: 60_000 });

const LOCKED_PATHS = [
  '/zion-archive',
  '/zion-archive/cist',
  '/zion-archive/nirvana/cist',
  '/zion-archive/surta-srdce/cist',
  '/zion-archive/kralovstvi-srdce/cist',
  '/zion-archive/ekam/cist',
  '/zion-archive/quantum-revolution/cist',
  '/zion-archive/sulzeme/cist',
  '/zion-archive/lumi/cist',
  '/zion-archive/miriam/cist',
  '/zion-archive/bodhigaia/cist',
  '/zion-archive/mariacaminho/cist',
  '/zion-archive/naceste/cist',
  '/zion-archive/nirvanacloud/cist',
  '/zion-archive/issobella/cist',
  '/zion-archive/miseamenti/cist',
  '/zion-archive/ruze/cist',
  '/zion-archive/kruhbohyni/cist',
];

test.describe('Zion Archive — lock gate', () => {
  for (const path of LOCKED_PATHS) {
    test(`${path} renders the coming-soon lock`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: /Zion Archive/i }).first()).toBeVisible();
      await expect(page.getByText(/Otevírá se brzy|Opening soon/i).first()).toBeVisible();
      await expect(page.getByRole('link', { name: /Marketplace/i }).first()).toBeVisible();
    });
  }

  test('legacy /maitreya urls permanent-redirect to /zion-archive', async ({ page }) => {
    const res = await page.goto('/maitreya', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(200);
    expect(page.url()).toContain('/zion-archive');
    await expect(page.getByRole('heading', { name: /Zion Archive/i }).first()).toBeVisible();
  });

  test('legacy /maitreya/<book>/cist redirects keep the path under /zion-archive', async ({
    page,
  }) => {
    await page.goto('/maitreya/nirvana/cist', { waitUntil: 'domcontentloaded' });
    expect(page.url()).toContain('/zion-archive/nirvana/cist');
    await expect(page.getByRole('heading', { name: /Zion Archive/i }).first()).toBeVisible();
  });

  test('access status endpoint reports no access anonymously', async ({
    request,
  }) => {
    const res = await request.get('/api/archive/access');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.access).toBe(false);
    expect(body.via).toBeNull();
  });

  test('entitlements admin API rejects requests without a token', async ({
    request,
  }) => {
    const res = await request.get('/api/archive/entitlements');
    expect(res.status()).toBe(401);
  });

  test('access-code form renders and rejects an invalid code', async ({ page }) => {
    await page.goto('/zion-archive', { waitUntil: 'domcontentloaded' });
    const input = page.locator('#archive-code');
    await expect(input).toBeVisible();
    await input.fill('definitely-not-a-real-code');
    await page.getByRole('button', { name: /Odemknout|Unlock/i }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    // still locked — the archive tree did not unlock for a bad code
    await expect(page.getByRole('heading', { name: /Zion Archive/i }).first()).toBeVisible();
  });
});
