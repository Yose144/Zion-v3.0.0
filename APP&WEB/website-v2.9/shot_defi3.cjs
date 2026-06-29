const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto('https://zionterranova.com/defi', { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);
  // Get pool cards text
  const cards = await page.evaluate(() => {
    const sections = document.querySelectorAll('section');
    const out = [];
    sections.forEach(s => {
      const t = s.innerText;
      if (t.includes('wZION/USDT') || t.includes('TVL') || t.includes('CENA')) {
        out.push(t.substring(0, 500));
      }
    });
    return out.join('\n---\n');
  });
  console.log(cards);
  await browser.close();
})();
