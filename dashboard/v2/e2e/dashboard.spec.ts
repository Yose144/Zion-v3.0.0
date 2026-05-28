import { test, expect, type Page } from '@playwright/test';

async function openSidebarIfMobile(page: Page) {
  if ((page.viewportSize()?.width ?? 1280) < 768) {
    await page.click('button[aria-label="Open navigation"]');
  }
}

test.describe('Dashboard v2 E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads Overview tab by default', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await expect(page.locator('text=ZION').first()).toBeVisible();
  });

  test('navigates through core tabs', async ({ page }) => {
    const tabs = [
      { label: 'Logs', text: 'Live Logs' },
      { label: 'Explorer', text: 'Block Explorer' },
      { label: 'Controls', text: 'Node Controls' },
      { label: 'Charts', text: 'Analytics' },
      { label: 'Alerts', text: 'Alerts' },
    ];

    for (const t of tabs) {
      await openSidebarIfMobile(page);
      await page.locator('nav button', { hasText: t.label }).first().dispatchEvent('click');
      await expect(page.getByRole('heading', { name: t.text, exact: true }).first()).toBeVisible();
    }
  });

  test('theme switcher toggles themes', async ({ page }) => {
    const themeBtn = page.locator('button[title^="Theme:"]').first();
    await themeBtn.click();
    await page.locator('button:has-text("light")').first().dispatchEvent('click');
    await expect(page.locator('html[data-theme="light"]')).toBeAttached();

    await themeBtn.click();
    await page.locator('button:has-text("dark")').first().dispatchEvent('click');
    await expect(page.locator('html[data-theme="dark"]')).toBeAttached();
  });

  test('keyboard help modal opens and closes', async ({ page }) => {
    await page.click('button[title="Keyboard shortcuts (?)"]');
    await expect(page.locator('text=Keyboard Shortcuts')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('text=Keyboard Shortcuts')).toBeHidden();
  });
});
