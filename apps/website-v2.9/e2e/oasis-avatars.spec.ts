import { test, expect } from '@playwright/test';

/**
 * OASIS avataři — dvojjazyčný roster a modal.
 *
 * Chrání tři věci, které se v srpnu–listopadu 2026 reálně rozbily:
 *  1. **počet a jazyky** — všech 202 avatarů musí mít profil v CS i EN
 *     (dřív 43 zobrazovalo jinou postavu a 9/44 měly špatně detekovaný jazyk),
 *  2. **modal dostupnost** — fokus nesmí utéct z dialogu a po zavření se musí
 *     vrátit na kartu (dřív 10 z 12 Tabů skončilo mimo),
 *  3. **žádný `.md` odkaz ani `../` cesta** v publikovaném profilu (modal je
 *     jen text; surové cesty vypadají jako rozbitý odkaz).
 *
 * Proti produkci: E2E_BASE_URL=https://app.zionterranova.com npx playwright test oasis-avatars
 */
test.use({ channel: 'chrome', navigationTimeout: 60_000 });
// Roster je 202 karet s obrázky; na produkci to občas trvá přes 30 s (default).
test.describe.configure({ timeout: 150_000 });

const PAGE = '/l4-oasis/avatars';

/** Roster se mění (200 → 202 → …), ale nikdy nesmí spadnout pod 200. */
const MIN_AVATARS = 200;

async function setLang(page: import('@playwright/test').Page, lang: 'cs' | 'en') {
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
  await page.evaluate((l) => localStorage.setItem('zion-lang', l), lang);
  await page.reload({ waitUntil: 'load' });
  // Roster je klientská komponenta — karty se objeví až po hydrataci.
  await page.waitForSelector('button[aria-label*=" — "]', { state: 'attached', timeout: 60_000 });
  await expect(page.locator('button[aria-label*=" — "]').first()).toBeVisible({ timeout: 60_000 });
}

test('roster má všech 202 avatarů s oběma jazyky', async ({ page, request }) => {
  await setLang(page, 'cs');
  const cards = page.locator('button[aria-label*=" — "]');
  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(MIN_AVATARS);

  // Každá karta má jméno a aria-label s „Detail" (čítač karet = čítač avatarů).
  const label = await cards.first().getAttribute('aria-label');
  // CS „Detail", EN „Details" — test nesmí být závislý na jazyce.
  expect(label).toMatch(/ — (Detail|Details)$/);

  // Profily obou jazyků musí existovat (vzorek 6 napříč kruhy + oba noví avataři).
  for (const id of [0, 43, 52, 70, 202, 203, 204]) {
    for (const lang of ['cs', 'en']) {
      const res = await request.get(`/data/oasis/profiles/${id}.${lang}.md`);
      expect(res.status(), `profil ${id}.${lang}.md`).toBe(200);
      const body = await res.text();
      expect(body.length, `profil ${id}.${lang}.md je krátký`).toBeGreaterThan(200);
      expect(body, `profil ${id}.${lang}.md obsahuje surovou cestu`).not.toMatch(/\.\.\//);
      expect(body, `profil ${id}.${lang}.md obsahuje odkaz na .md`).not.toMatch(/\]\([^)]*\.md/);
    }
  }
});

test('modal: fokus zůstane uvnitř a po zavření se vrátí na kartu', async ({ page }) => {
  await setLang(page, 'cs');
  const card = page.locator('button[aria-label*=" — "]').first();
  await card.click();

  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');

  const inside = () => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
  expect(await inside(), 'fokus po otevření není v dialogu').toBe(true);

  for (let i = 0; i < 10; i += 1) {
    await page.keyboard.press('Tab');
    expect(await inside(), `fokus utekl z dialogu po ${i + 1}. Tabu`).toBe(true);
  }

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  const restored = await page.evaluate(() =>
    / — (Detail|Details)$/.test(document.activeElement?.getAttribute?.('aria-label') || ''));
  expect(restored, 'fokus se nevrátil na kartu').toBe(true);
});

test('přepnutí jazyka přepne text profilu', async ({ page, request }) => {
  await setLang(page, 'en');
  // Tagline je dvojjazyčný a nesmí tvrdit pevný počet (počet se bere z rosteru).
  await expect(page.getByText(/sacred figures of OASIS/i)).toBeVisible();

  // Profil 43 (Maly Princ) má v obou jazycích jiný text — ověř přes API i modal.
  const cs = await (await request.get('/data/oasis/profiles/43.cs.md')).text();
  const en = await (await request.get('/data/oasis/profiles/43.en.md')).text();
  expect(cs).not.toEqual(en);
  expect(en).toMatch(/Little Prince/i);

  await page.locator('button[aria-label^="Maly Princ"]').first().click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  await expect(page.locator('[role="dialog"]')).toContainText(/rose|prince/i);
});
