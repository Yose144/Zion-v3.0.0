import { test, expect } from '@playwright/test';

test.describe('Mobile viewport', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('hamburger opens and closes sidebar', async ({ page }) => {
    await page.goto('/');
    // initially hidden off-screen
    await expect(page.locator('aside')).toHaveClass(/-translate-x-full/);
    await page.click('button[aria-label="Open navigation"]');
    await expect(page.locator('aside')).toHaveClass(/translate-x-0/);
    await page.click('button[aria-label="Close navigation"]');
    await expect(page.locator('aside')).toHaveClass(/-translate-x-full/);
  });

  test('theme switcher reachable on mobile', async ({ page }) => {
    await page.goto('/');
    const themeBtn = page.locator('button[title^="Theme:"]').first();
    await themeBtn.click();
    await page.locator('button:has-text("light")').first().dispatchEvent('click');
    await expect(page.locator('html[data-theme="light"]')).toBeAttached();
  });
});
