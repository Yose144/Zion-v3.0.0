import { test, expect } from '@playwright/test';

async function openControls(page: any) {
  await page.goto('/');
  const isMobile = (page.viewportSize()?.width ?? 1280) < 768;
  if (isMobile) {
    await page.click('button[aria-label="Open navigation"]');
  }
  await page.getByRole('button', { name: 'Controls' }).click();
  await expect(page.getByRole('heading', { name: 'Node Controls' })).toBeVisible();
}

test.describe('Controls tab', () => {
  test.beforeEach(async ({ page }) => {
    await openControls(page);
  });

  test('shows launch and stop buttons', async ({ page }) => {
    await expect(page.locator('button:has-text("Launch Full Stack")')).toBeVisible();
    await expect(page.locator('button:has-text("Stop Stack")')).toBeVisible();
    await expect(page.locator('button:has-text("Stop All")')).toBeVisible();
  });

  test('shows service names in control rows', async ({ page }) => {
    await expect(page.getByText('Node 1', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Pool', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Miner', { exact: false }).first()).toBeVisible();
  });
});
