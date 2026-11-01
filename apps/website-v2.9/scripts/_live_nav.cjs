const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const out = [];
  for (const [w,h,name] of [[1280,800,'desk'],[1024,700,'lap'],[390,844,'mob']]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto('https://app.zionterranova.com/', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(2500);
    const info = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      pills: (() => { const p = document.querySelector('[data-nav-desktop] button[aria-haspopup="true"]'); return p ? !!p.offsetParent : false; })(),
    }));
    if (w >= 1024) {
      const pill = page.locator('[data-nav-desktop] button[aria-haspopup="true"]').nth(2);
      for (let i=0;i<8;i++){ await pill.click(); await page.waitForTimeout(400); if (await page.locator('#nav-mega-panel').count()) break; }
      const t = page.locator('#nav-mega-panel button[aria-expanded]');
      if (await t.count()) { await t.first().click(); await page.waitForTimeout(500); }
      const box = await page.locator('#nav-mega-panel').boundingBox();
      info.panel = { y: Math.round(box.y), bottom: Math.round(box.y+box.height), fits: box.y+box.height <= h && box.x >= 0 && box.x + box.width <= w };
      await page.screenshot({ path: `/tmp/live/${name}.png`, clip: { x: 0, y: 0, width: w, height: Math.min(h, 720) } });
    } else {
      const burger = page.locator('[data-nav-desktop] button[aria-controls="mobile-nav-drawer"]').first();
      for (let i=0;i<8;i++){ await burger.click(); await page.waitForTimeout(400); if (await page.locator('#mobile-nav-drawer').count()) break; }
      await page.locator('#mobile-nav-drawer button[aria-expanded]').nth(2).click();
      await page.waitForTimeout(400);
      const sub = page.locator('#mobile-nav-drawer button[aria-controls^="navmobilesub"]').first();
      if (await sub.count()) { await sub.click(); await page.waitForTimeout(400); }
      info.drawer = await page.locator('#mobile-nav-drawer').count();
      await page.screenshot({ path: `/tmp/live/${name}.png` });
    }
    out.push({ name, ...info });
    await page.close();
  }
  console.log(JSON.stringify(out));
  await browser.close();
})();
