const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1600 }, deviceScaleFactor: 1 });
  await page.goto('https://zionterranova.com/defi', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'C:/Users/yosef/AppData/Local/Temp/defi_full.png', fullPage: true });
  console.log('Screenshot saved');
  await browser.close();
})();
