const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto('https://zionterranova.com/defi', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  const data = await page.evaluate(() => {
    const text = document.body.innerText;
    return text.substring(0, 4000);
  });
  console.log(data);
  await browser.close();
})();
