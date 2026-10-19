import { test, expect, type Page } from '@playwright/test';
import { MAITREYA_CHAPTERS } from '../src/app/maitreya/chapters';
import { NIRVANA_CHAPTERS } from '../src/app/nirvana/chapters';
import { DOC_IDS, DOC_HASH_ALIASES } from '../src/lib/docs-manifest';
import { NIRVANA_WORKSTREAMS } from '../src/lib/nirvana-roadmap';
import { MAIN_BOOKS, COMPANION_GROUPS } from '../src/app/maitreya/library';

// No bundled Playwright browsers in this environment — use installed Chrome.
// Dev-server compiles can exceed 30s under parallel workers — give navigations
// and tests more headroom instead of flaking.
test.use({ channel: 'chrome', navigationTimeout: 60_000 });

const SECTION_IDS = ['cesta', 'kniha', 'nirvana', 'plan-v33', 'spolecnici', 'souvislosti'] as const;

test.beforeEach(async ({ context }) => {
  // Stub unrelated background API calls (auth probe, Hiran chat, pool feeds, …)
  // so tests never depend on live backends. Document assets stay untouched.
  await context.route(/\/api\//, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  );
  // Block any non-localhost request outright.
  await context.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) => route.abort());
});

const KNOWN_WARN = /same key.*\/multichain#bridge|non-unique keys/i;

function watchPageErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !KNOWN_WARN.test(msg.text())) {
      errors.push(`[console.error] ${msg.text()}`);
    }
  });
  return errors;
}

const activePanel = (page: Page) => page.locator('section[data-panel]');
const navLink = (page: Page, id: string) => page.locator(`a[href="#${id}"]:visible`).first();

test.describe('maitreya hub', () => {
  test.setTimeout(120_000);
  test('default view shows the ordered books with six real read links', async ({ page }) => {
    const errors = watchPageErrors(page);
    await page.goto('/maitreya');
    await expect(activePanel(page)).toHaveCount(1);
    await expect(activePanel(page)).toHaveAttribute('data-panel', 'cesta');

    const readLinks = page.locator('section[data-panel] a', { hasText: /číst|read|otevřít/i });
    const hrefs = await page
      .locator('section[data-panel="cesta"] ol a[href]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    for (const book of MAIN_BOOKS) {
      expect(hrefs).toContain(book.readHref);
      if (book.aboutHref) expect(hrefs).toContain(book.aboutHref);
    }
    await expect(readLinks.first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('section nav selects exactly one panel via real hash links', async ({ page }) => {
    const errors = watchPageErrors(page);
    await page.goto('/maitreya');
    for (const id of SECTION_IDS) {
      await navLink(page, id).first().click();
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      await expect(page.locator(`section[data-panel="${id}"]`)).toBeVisible();
      await expect(activePanel(page)).toHaveCount(1);
      await expect(
        page.locator(`a[href="#${id}"][aria-current="true"]:visible`).first()
      ).toBeVisible();
    }
    expect(errors).toEqual([]);
  });

  test('direct hashes open the right panels (legacy + new)', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchPageErrors(page);
    for (const id of SECTION_IDS) {
      await page.goto(`/maitreya#${id}`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator(`section[data-panel="${id}"]`)).toBeVisible({ timeout: 20000 });
      await expect(activePanel(page)).toHaveCount(1);
    }
    // legacy redirect targets land on their panels too
    await page.goto('/cesta', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('section[data-panel="cesta"]')).toBeVisible({ timeout: 20000 });
    await page.goto('/nirvana', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('section[data-panel="nirvana"]')).toBeVisible({ timeout: 20000 });
    expect(errors).toEqual([]);
  });

  test('browser back/forward walks the section history', async ({ page }) => {
    const errors = watchPageErrors(page);
    await page.goto('/maitreya');
    await navLink(page, 'kniha').first().click();
    await expect(page).toHaveURL(/#kniha$/);
    await navLink(page, 'plan-v33').first().click();
    await expect(page).toHaveURL(/#plan-v33$/);

    await page.goBack();
    await expect(page).toHaveURL(/#kniha$/);
    await expect(page.locator('section[data-panel="kniha"]')).toBeVisible();

    await page.goBack();
    await expect(page.locator('section[data-panel="cesta"]')).toBeVisible();

    await page.goForward();
    await expect(page.locator('section[data-panel="kniha"]')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('keyboard: nav focus, enter selects panel, details expands', async ({ page }) => {
    const errors = watchPageErrors(page);
    await page.goto('/maitreya');
    await navLink(page, 'souvislosti').first().focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('section[data-panel="souvislosti"]')).toBeVisible();

    const details = page.locator('section[data-panel="souvislosti"] details').nth(1);
    await expect(details).not.toHaveAttribute('open', '');
    const summary = details.locator('summary');
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(details).toHaveAttribute('open', '');

    // heading received focus after panel selection
    await page.locator('a[href="#kniha"]:visible').first().click();
    await expect(page.locator('#kniha-title')).toBeFocused();
    expect(errors).toEqual([]);
  });

  test('kniha panel links to prologue, epilogue and the first chapter of each part', async ({
    page,
  }) => {
    const errors = watchPageErrors(page);
    await page.goto('/maitreya#kniha');
    const panel = page.locator('section[data-panel="kniha"]');
    await expect(panel).toBeVisible({ timeout: 20000 });
    const hrefs = await panel
      .locator('a[href]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href')));

    expect(hrefs).toContain('/maitreya/cist#prolog');
    expect(hrefs).toContain('/maitreya/cist#epilog');
    for (const part of [1, 2, 3, 4, 5]) {
      const first = MAITREYA_CHAPTERS.find((c) => c.part === part);
      expect(first, `part ${part} must have a first chapter`).toBeTruthy();
      expect(hrefs).toContain(`/maitreya/cist#${first!.slug}`);
    }
    expect(errors).toEqual([]);
  });

  test('nirvana panel links all 12+1 episodes with honest framing', async ({ page }) => {
    const errors = watchPageErrors(page);
    await page.goto('/maitreya#nirvana');
    const panel = page.locator('section[data-panel="nirvana"]');
    await expect(panel).toBeVisible({ timeout: 20000 });
    const hrefs = await panel
      .locator('a[href]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href')));

    const episodes = NIRVANA_CHAPTERS.filter((c) => c.part === 1);
    expect(episodes.length).toBe(12);
    for (const ep of episodes) {
      expect(hrefs).toContain(`/nirvana/cist#${ep.slug}`);
    }
    expect(hrefs).toContain('/nirvana/cist#13-Tres-Marias');
    expect(hrefs).toContain('/terranova/maria-del-camino');

    // published-book disclaimer present; no fake live/building status chips
    await expect(panel).toContainText(/publikovaná|published/i);
    const text = await panel.innerText();
    expect(text).not.toMatch(/\b(živé|live|stavba|building)\b/i);
    expect(errors).toEqual([]);
  });

  test('plan-v33 shows six workstreams with honest goal framing', async ({ page }) => {
    const errors = watchPageErrors(page);
    await page.goto('/maitreya#plan-v33');
    const panel = page.locator('section[data-panel="plan-v33"]');

    const cards = panel.locator('[data-workstream]');
    await expect(cards).toHaveCount(6);
    for (const w of NIRVANA_WORKSTREAMS) {
      const card = panel.locator(`[data-workstream="${w.id}"]`);
      await expect(card).toContainText(w.title.cs);
      await expect(card).toContainText(w.goal.cs.slice(0, 40));
      const cardHrefs = await card
        .locator('a[href]')
        .evaluateAll((els) => els.map((e) => e.getAttribute('href')));
      expect(cardHrefs).toContain(w.layerHref);
      expect(cardHrefs).toContain(`/nirvana/cist#${w.chapterSlug}`);
    }

    // valid list markup — no nested <li> (was a hydration bug)
    await expect(panel.locator('li li')).toHaveCount(0);

    // prerequisite strip + baseline gate + release gate + status legend
    await expect(panel).toContainText(/3\.2/);
    await expect(panel).toContainText(/testovaná obnova|tested restore/i);
    const hrefs = await panel
      .locator('a[href]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    expect(hrefs).toContain('/g8');
    expect(hrefs).toContain('/roadmap#nirvana');
    await expect(panel).toContainText(/dostupné čtení|available reading/i);
    await expect(panel).toContainText(/vývojový cíl|development goal/i);
    await expect(panel).toContainText(/hypotéza|hypothesis/i);
    // horizon framing — no promised date / percentages
    const text = await panel.innerText();
    expect(text).not.toMatch(/\d+\s*%\s*(hotovo|done|complete)/i);
    expect(errors).toEqual([]);
  });

  test('spolecnici panel: every companion is a real link with honest labels', async ({ page }) => {
    const errors = watchPageErrors(page);
    await page.goto('/maitreya#spolecnici');
    const panel = page.locator('section[data-panel="spolecnici"]');
    await expect(panel).toBeVisible({ timeout: 20000 });
    const hrefs = await panel
      .locator('a[href]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href')));

    for (const group of COMPANION_GROUPS) {
      for (const item of group.items) {
        expect(hrefs).toContain(item.href);
        if (item.enHref) expect(hrefs).toContain(item.enHref);
      }
    }
    // honest language labels present (locale-dependent strings)
    await expect(panel).toContainText(/anglický index|english index/i);
    await expect(panel).toContainText(/česky|czech only/i);
    expect(errors).toEqual([]);
  });

  test('companion raw assets exist and EN indexes are honest', async ({ request }) => {
    const seen = new Set<string>();
    for (const group of COMPANION_GROUPS) {
      for (const item of group.items) {
        for (const href of [item.href, item.enHref].filter(Boolean) as string[]) {
          const raw = href.replace('/docs/view/', '/docs/');
          if (seen.has(raw)) continue;
          seen.add(raw);
          const res = await request.get(raw);
          expect(res.status(), `raw asset ${raw}`).toBe(200);
          const body = await res.text();
          expect(body.length).toBeGreaterThan(200);
        }
      }
    }
  });

  test('all internal links across panels resolve (routes, ids, slugs, assets)', async ({
    page,
    request,
  }) => {
    test.setTimeout(240_000); // dev server compiles each route on first hit
    const errors = watchPageErrors(page);
    const maitreyaSlugs = new Set(MAITREYA_CHAPTERS.map((c) => c.slug));
    const nirvanaSlugs = new Set(NIRVANA_CHAPTERS.map((c) => c.slug));
    const docsIds = new Set([...DOC_IDS, ...Object.keys(DOC_HASH_ALIASES)]);

    const collected = new Set<string>();
    for (const id of SECTION_IDS) {
      await page.goto(`/maitreya#${id}`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator(`section[data-panel="${id}"]`)).toBeVisible({ timeout: 20000 });
      const hrefs = await page
        .locator(`section[data-panel="${id}"] a[href], main a[href^="/"], main a[href^="#"]`)
        .evaluateAll((els) => els.map((e) => e.getAttribute('href')));
      for (const h of hrefs) if (h) collected.add(h);
    }

    const routesToFetch = new Set<string>();
    for (const href of collected) {
      if (href.startsWith('#')) {
        expect(SECTION_IDS as readonly string[]).toContain(href.slice(1));
        continue;
      }
      if (!href.startsWith('/')) continue; // external left to browser block
      const [path, hash] = href.split('#');

      if (path === '/docs' && hash) {
        expect(docsIds.has(hash), `docs id #${hash}`).toBeTruthy();
        continue;
      }
      if (path === '/maitreya/cist' && hash) {
        expect(maitreyaSlugs.has(hash), `maitreya slug #${hash}`).toBeTruthy();
      }
      if (path === '/nirvana/cist' && hash) {
        expect(nirvanaSlugs.has(hash), `nirvana slug #${hash}`).toBeTruthy();
      }
      if (path === '/maitreya' && hash) {
        expect(SECTION_IDS as readonly string[]).toContain(hash);
      }
      if (path.startsWith('/docs/view/')) {
        routesToFetch.add(path.replace('/docs/view/', '/docs/'));
      }
      routesToFetch.add(path);
    }

    // fan out in small batches — dev compiles each route on first request
    const getWithRetry = async (path: string) => {
      let last: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          return await request.get(path);
        } catch (e) {
          last = e;
          await new Promise((r) => setTimeout(r, 500));
        }
      }
      throw last;
    };
    const queue = [...routesToFetch];
    while (queue.length) {
      const batch = queue.splice(0, 4);
      const results = await Promise.all(batch.map((p) => getWithRetry(p)));
      for (let i = 0; i < batch.length; i++) {
        if (batch[i].startsWith('/docs/')) {
          expect(results[i].status(), `asset ${batch[i]}`).toBe(200);
        } else {
          expect(results[i].status(), `route ${batch[i]}`).toBeLessThanOrEqual(399);
        }
      }
    }
    expect(collected.size).toBeGreaterThan(20);
    expect(errors).toEqual([]);
  });

  test('companion viewer and chapter 13 reader load real articles', async ({ page }) => {
    test.setTimeout(120_000); // dev compiles the reader pages on first hit
    const errors = watchPageErrors(page);

    // SulZeme viewer — assert the real markdown asset was fetched AND rendered.
    const sulzeme = page.waitForResponse(
      (res) => res.url().includes('/docs/korpus/SulZeme/00-README.md') && res.status() === 200,
      { timeout: 30000 }
    );
    await page.goto('/docs/view/korpus/SulZeme/00-README.md', { waitUntil: 'domcontentloaded' });
    await sulzeme;
    await expect(page.locator('body')).not.toContainText(/nebyl nalezen|not found/i);
    // Article content unique to the document body — not the viewer chrome.
    await expect(page.locator('body')).toContainText(/Dvanáct zastavení na cestě k Oasis/i, {
      timeout: 30000,
    });
    await expect(page.locator('body')).toContainText(/Sůl této země/i);

    // Tres Marías reader (CZ canonical text) — fetched asset + episode body.
    const tresMarias = page.waitForResponse(
      (res) => res.url().includes('/docs/books/nirvana/kapitoly/13-Tres-Marias.md') && res.status() === 200,
      { timeout: 30000 }
    );
    await page.goto('/nirvana/cist#13-Tres-Marias', { waitUntil: 'domcontentloaded' });
    await tresMarias;
    await expect(page.locator('body')).toContainText(/flotila Cesty|trupy pro tři oceány/i, {
      timeout: 30000,
    });
    await expect(page.locator('body')).not.toContainText(/nepodařilo načíst|could not be loaded/i);
    expect(errors).toEqual([]);
  });

  test('mobile 390px and narrow 320px have no horizontal body overflow', async ({ browser }) => {
    test.setTimeout(180_000);
    for (const width of [390, 320]) {
      const ctx = await browser.newContext({ viewport: { width, height: 844 } });
      const page = await ctx.newPage();
      await contextRouteStubs(ctx);
      const errors = watchPageErrors(page);
      for (const id of SECTION_IDS) {
        await page.goto(`/maitreya#${id}`, { waitUntil: 'domcontentloaded' });
        await expect(page.locator(`section[data-panel="${id}"]`)).toBeVisible({ timeout: 20000 });
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        expect(overflow, `horizontal overflow at ${width}px on #${id}`).toBeLessThanOrEqual(1);
      }
      // long titles wrap — no truncated nowrap titles in cesta cards
      const nowrap = await page
        .locator('section[data-panel] h3, section[data-panel] h4')
        .evaluateAll((els) =>
          els.filter(
            (e) => e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).whiteSpace === 'nowrap'
          ).length
        );
      expect(nowrap).toBe(0);
      expect(errors).toEqual([]);
      await ctx.close();
    }
  });

  test('EN locale: headings, localized primary links and honest labels', async ({ page }) => {
    const errors = watchPageErrors(page);
    await page.addInitScript(() => window.localStorage.setItem('zion-lang', 'en'));

    const titles: Record<(typeof SECTION_IDS)[number], RegExp> = {
      cesta: /Books & reading order/i,
      kniha: /Maitreya — the full book/i,
      nirvana: /Nirvana — twelve stations/i,
      'plan-v33': /v3\.3/i,
      spolecnici: /Companion books/i,
      souvislosti: /Story & tradition/i,
    };
    for (const id of SECTION_IDS) {
      await page.goto(`/maitreya#${id}`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator(`#${id}-title`)).toHaveText(titles[id], { timeout: 20000 });
    }

    // cesta: Salt center goes to the EN index in EN mode
    await page.goto('/maitreya#cesta', { waitUntil: 'domcontentloaded' });
    const cestaHrefs = await page
      .locator('section[data-panel="cesta"] a[href]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    expect(cestaHrefs).toContain('/docs/view/korpus/SulZeme/00-README_EN.md');
    expect(cestaHrefs).not.toContain('/docs/view/korpus/SulZeme/00-README.md');

    // nirvana: BodhiGaia bridge uses EN index; MariaCaminho stays visibly CZ-only
    await page.goto('/maitreya#nirvana', { waitUntil: 'domcontentloaded' });
    const nirvanaHrefs = await page
      .locator('section[data-panel="nirvana"] a[href]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    expect(nirvanaHrefs).toContain('/docs/view/korpus/BodhiGaia/00-README_EN.md');
    expect(nirvanaHrefs).toContain('/docs/view/korpus/MariaCaminho/00-README.md');

    // spolecnici: EN primary = English index + Czech-original secondary; CZ-only flagged
    await page.goto('/maitreya#spolecnici', { waitUntil: 'domcontentloaded' });
    const panel = page.locator('section[data-panel="spolecnici"]');
    await expect(panel).toBeVisible({ timeout: 20000 });
    const hrefs = await panel
      .locator('a[href]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    for (const group of COMPANION_GROUPS) {
      for (const item of group.items) {
        if (item.enHref) {
          expect(hrefs).toContain(item.enHref);
          expect(hrefs).toContain(item.href); // Czech original remains linked
        } else {
          expect(hrefs).toContain(item.href);
        }
      }
    }
    await expect(panel).toContainText(/English index/i);
    await expect(panel).toContainText(/Czech original/i);
    await expect(panel).toContainText(/Read the chapter/i);
    expect(errors).toEqual([]);
  });

  test('sticky navs stay usable and headings clear them when scrolled', async ({ browser }) => {
    test.setTimeout(120_000);
    // desktop: sidebar remains in viewport while a long panel is scrolled
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      const page = await ctx.newPage();
      await contextRouteStubs(ctx);
      const errors = watchPageErrors(page);
      await page.goto('/maitreya#plan-v33', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('section[data-panel="plan-v33"]')).toBeVisible({ timeout: 20000 });
      // scrolled mid-lane, the sticky sidebar holds near top-24 (~96px)
      await page.evaluate(() => window.scrollTo(0, 700));
      await page.waitForTimeout(400);
      const nav = page.locator('aside nav');
      const box = await nav.boundingBox();
      expect(box, 'desktop sidebar scrolled out of view').not.toBeNull();
      expect(box!.y).toBeGreaterThanOrEqual(80);
      expect(box!.y).toBeLessThanOrEqual(140);
      // and at the very bottom it exits only with its lane — never mid-content
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(400);
      const endBox = await nav.boundingBox();
      expect(endBox, 'desktop sidebar at page end').not.toBeNull();
      expect(endBox!.y).toBeGreaterThan(-200);
      expect(errors).toEqual([]);
      await ctx.close();
    }
    // mobile: chooser sticks under the global nav; selected heading clears it
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await ctx.newPage();
      await contextRouteStubs(ctx);
      const errors = watchPageErrors(page);
      await page.goto('/maitreya#nirvana', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('section[data-panel="nirvana"]')).toBeVisible({ timeout: 20000 });
      await page.evaluate(() => window.scrollTo(0, 900));
      await page.waitForTimeout(400);
      const chooser = page.locator('nav[aria-label]').first();
      const chooserBox = await chooser.boundingBox();
      expect(chooserBox, 'mobile chooser scrolled offscreen').not.toBeNull();
      expect(chooserBox!.y).toBeGreaterThanOrEqual(40);
      expect(chooserBox!.y).toBeLessThanOrEqual(90);
      // select another panel — heading must end up below the sticky chooser
      await page.locator('a[href="#plan-v33"]:visible').first().click();
      await page.waitForTimeout(1200); // smooth scroll settle
      const headingBox = await page.locator('#plan-v33-title').boundingBox();
      const chooserNow = await chooser.boundingBox();
      expect(headingBox).not.toBeNull();
      expect(chooserNow).not.toBeNull();
      expect(
        headingBox!.y,
        `heading y=${headingBox!.y} must clear chooser bottom=${chooserNow!.y + chooserNow!.height}`
      ).toBeGreaterThanOrEqual(chooserNow!.y + chooserNow!.height - 4);
      expect(errors).toEqual([]);
      await ctx.close();
    }
  });

  test('tablet 768px layout is sane', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 768, height: 1000 } });
    const page = await ctx.newPage();
    await contextRouteStubs(ctx);
    const errors = watchPageErrors(page);
    await page.goto('/maitreya#plan-v33');
    await expect(page.locator('section[data-panel="plan-v33"]')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
    // section nav wraps as pills (sidebar hidden below lg)
    await expect(page.locator('a[href="#cesta"]:visible').first()).toBeVisible();
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('mobile: prereq paragraph full width + active pill inside chooser', async ({ browser }) => {
    test.setTimeout(240_000);
    for (const width of [320, 390]) {
      for (const lang of ['cs', 'en']) {
        const ctx = await browser.newContext({ viewport: { width, height: 844 } });
        const page = await ctx.newPage();
        await contextRouteStubs(ctx);
        if (lang === 'en')
          await page.addInitScript(() => window.localStorage.setItem('zion-lang', 'en'));
        const errors = watchPageErrors(page);
        for (const id of ['plan-v33', 'spolecnici'] as const) {
          await page.goto(`/maitreya#${id}`, { waitUntil: 'domcontentloaded' });
          await expect(page.locator(`section[data-panel="${id}"]`)).toBeVisible({ timeout: 30000 });
          await page.waitForTimeout(1200); // chooser smooth-scroll settle
          const chooser = page.locator('nav[aria-label]').first();
          const cb = await chooser.boundingBox();
          const pb = await page.locator(`nav a[href="#${id}"]`).first().boundingBox();
          expect(cb).not.toBeNull();
          expect(pb, `active pill at ${width}/${lang}/${id}`).not.toBeNull();
          expect(pb!.x).toBeGreaterThanOrEqual(cb!.x - 2);
          expect(pb!.x + pb!.width).toBeLessThanOrEqual(cb!.x + cb!.width + 2);
          if (id === 'plan-v33') {
            const pw = await page
              .locator('section[data-panel="plan-v33"] .grid.gap-3 > p')
              .first()
              .evaluate((el) => el.getBoundingClientRect().width);
            // full text width — never squeezed to ~one word
            expect(pw, `prereq paragraph width at ${width}`).toBeGreaterThanOrEqual(
              width * 0.6
            );
          }
        }
        expect(errors).toEqual([]);
        await ctx.close();
      }
    }
  });

  test('smoke: whitepapers and reader still work after global clip fix', async ({ browser }) => {
    test.setTimeout(120_000);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await contextRouteStubs(ctx);
    const errors = watchPageErrors(page);
    for (const path of ['/whitepapers', '/maitreya/cist']) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 30000 });
      await page.evaluate(() => window.scrollTo(0, 400));
      await page.waitForTimeout(300);
      const y = await page.evaluate(() => window.scrollY);
      expect(y, `${path} did not scroll`).toBeGreaterThan(100);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, `${path} overflow`).toBeLessThanOrEqual(1);
    }
    // global mobile menu opens/closes. Synthetic click avoids pointer racing with
    // the drawer overlay that covers the button the moment it opens.
    const menuBtn = page.locator('nav button[aria-label*="menu" i]').first();
    await expect(menuBtn).toBeVisible();
    const menuOpen = () =>
      page.locator('body').evaluate((el) => el.classList.contains('menu-open'));
    // retry — the first click may land before React hydration attaches the handler
    for (let i = 0; i < 6 && !(await menuOpen()); i++) {
      await menuBtn.evaluate((el: HTMLElement) => el.click());
      await page.waitForTimeout(800);
    }
    await expect(page.locator('body')).toHaveClass(/menu-open/, { timeout: 5000 });
    for (let i = 0; i < 6 && (await menuOpen()); i++) {
      await menuBtn.evaluate((el: HTMLElement) => el.click());
      await page.waitForTimeout(800);
    }
    await expect(page.locator('body')).not.toHaveClass(/menu-open/, { timeout: 5000 });
    expect(errors).toEqual([]);
    await ctx.close();
  });


});

async function contextRouteStubs(ctx: import('@playwright/test').BrowserContext) {
  await ctx.route(/\/api\//, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  );
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) => route.abort());
}
