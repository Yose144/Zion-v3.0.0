// Společné načtení prohlížeče pro E2E v `apps/nirvana/e2e/`.
//
// Proč samostatný soubor: každý E2E měl vlastní hardcoded cestu k Playwrightu
// i k Chromiu z macOS (`/Users/yeshuae/…`), takže se testy daly spustit jen na
// jednom stroji. Tady je jedno místo, které zkouší rozumné možnosti v pořadí:
//
//   1. `PLAYWRIGHT_MODULE` / `CHROME_PATH` z prostředí
//   2. Playwright jako běžný modul projektu
//   3. puppeteer cache (macOS i Linux)
//   4. systémový Chrome/Chromium
//
// Když nic neexistuje, skript skončí kódem 2 a řekne, co nastavit — místo
// `MODULE_NOT_FOUND` z importu.

import { createRequire } from 'node:module';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);

/** Playwright: buď z projektu, nebo z explicitní cesty. `null` = zkusí se puppeteer. */
export async function loadChromium() {
  try {
    const mod = await import('playwright');
    return mod.chromium;
  } catch {
    const explicit = process.env.PLAYWRIGHT_MODULE;
    if (explicit) {
      try {
        return require(explicit).chromium;
      } catch {
        return null;
      }
    }
    // Globální instalace (nvm a pod.): `npm i -g playwright` — stejný fallback
    // jako v mobile-audit.mjs, ať E2E běží i bez lokální závislosti.
    const globalRoots = [];
    try {
      globalRoots.push(join(homedir(), '.nvm/versions/node'));
    } catch {
      /* ignore */
    }
    for (const root of globalRoots) {
      try {
        for (const ver of readdirSync(root)) {
          const candidate = join(root, ver, 'lib/node_modules/playwright');
          if (existsSync(candidate)) {
            try {
              return require(candidate).chromium;
            } catch {
              /* zkusíme další verzi */
            }
          }
        }
      } catch {
        /* adresář neexistuje */
      }
    }
    return null;
  }
}

/** Najde spustitelný Chromium. První, co existuje, vyhraje. */
export function resolveExecutable() {
  const candidates = [process.env.CHROME_PATH].filter(Boolean);

  // puppeteer cache — verze se mění, takže se prochází adresář
  const cacheRoots = [join(homedir(), '.cache', 'puppeteer'), join(homedir(), 'Library', 'Caches', 'puppeteer')];
  for (const root of cacheRoots) {
    try {
      for (const dir of readdirSync(root)) {
        const base = join(root, dir);
        for (const inner of readdirSync(base)) {
          for (const bin of [
            'chrome-headless-shell-linux64/chrome-headless-shell',
            'chrome-headless-shell-mac-arm64/chrome-headless-shell',
            'chrome-headless-shell-mac-x64/chrome-headless-shell',
            'chrome-linux64/chrome',
            'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
            'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
          ]) {
            candidates.push(join(base, inner, bin));
          }
        }
      }
    } catch {
      // cache neexistuje — zkusíme systémový prohlížeč
    }
  }

  candidates.push(
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  );

  const found = candidates.find((path) => existsSync(path));
  if (!found) {
    console.error('e2e: žádný prohlížeč. Nastav CHROME_PATH=/cesta/k/chrome');
    process.exit(2);
  }
  return found;
}

/**
 * GPU režim. Výchozí je swiftshader (funguje všude, ale fps je bezcenné).
 * `ZION_GPU=metal` zapne skutečnou GPU (na macOS ANGLE/Metal) — používá se
 * pro screenshoty a měření fps, ne pro CI.
 */
function gpuArgs() {
  if (process.env.ZION_GPU === 'metal') {
    return ['--no-sandbox', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'];
  }
  return ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'];
}

/**
 * Sjednotí mediální emulaci mezi Playwrightem a Puppeteerem.
 *
 * `page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])`
 * je Puppeteer API; Playwright má `page.emulateMedia({ reducedMotion })`.
 * E2E (flotila) volá první variantu, takže pod Playwrightem tiše nic nedělala
 * a test „scéna respektuje prefers-reduced-motion“ padal na timeout.
 */
function shimPage(page) {
  if (!page || page.__zionShim) return page;
  page.__zionShim = true;
  // Puppeteer: `evaluateOnNewDocument`; Playwright: `addInitScript`
  if (typeof page.evaluateOnNewDocument !== 'function' && typeof page.addInitScript === 'function') {
    page.evaluateOnNewDocument = (fn, arg) => page.addInitScript(fn, arg);
  }
  if (typeof page.emulateMediaFeatures !== 'function' && typeof page.emulateMedia === 'function') {
    page.emulateMediaFeatures = async (features = []) => {
      const media = {};
      for (const feature of features) {
        if (feature.name === 'prefers-reduced-motion') media.reducedMotion = feature.value;
        else if (feature.name === 'prefers-color-scheme') media.colorScheme = feature.value;
        else if (feature.name === 'prefers-contrast') media.contrast = feature.value;
        else if (feature.name === 'forced-colors') media.forcedColors = feature.value;
      }
      await page.emulateMedia(media);
    };
  }
  return page;
}

/** Obalí `newPage`/`newContext` tak, aby každá stránka měla `emulateMediaFeatures`. */
function shimBrowser(browser) {
  if (typeof browser.newPage === 'function') {
    const original = browser.newPage.bind(browser);
    browser.newPage = async (options) => shimPage(await original(options));
  }
  if (typeof browser.newContext === 'function') {
    const originalContext = browser.newContext.bind(browser);
    browser.newContext = async (options) => {
      const context = await originalContext(options);
      if (typeof context.newPage === 'function') {
        const originalPage = context.newPage.bind(context);
        context.newPage = async (pageOptions) => shimPage(await originalPage(pageOptions));
      }
      return context;
    };
  }
  return browser;
}

/** Spustí prohlížeč. Playwright, když je; jinak puppeteer (stejné API v rozsahu E2E). */
export async function launch(options = {}) {
  const chromium = await loadChromium();
  if (chromium) {
    return shimBrowser(
      await chromium.launch({
        executablePath: resolveExecutable(),
        args: gpuArgs(),
        ...options,
      }),
    );
  }
  return launchPuppeteer(options);
}

/**
 * Dotykové zařízení.
 *
 * `isMobile` + `hasTouch` nestačí jen na viewport — bez nich se v Chromiu
 * **nevyhodnotí `@media (hover: none) and (pointer: coarse)`**, takže hra
 * schová dotykové ovládání a audit by mohl „projít" na prázdné obrazovce
 * (přesně tahle past je zapsaná u mobilního auditu MOBY).
 */
/** Tvar je `{ viewport, isMobile, hasTouch }` — projde oběma cestami (Playwright i Puppeteer). */
export const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
export const PHONE_LANDSCAPE = { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true };

/**
 * Puppeteer fallback.
 *
 * Repo nemá Playwright jako závislost (E2E si ho tahá zvenčí), ale puppeteer
 * na stroji často je. E2E skripty používají jen hrstku metod a ty se chovají
 * stejně — rozdíly (viewport, `waitUntil: 'networkidle'`) se srovnají tady,
 * aby testy zůstaly napsané jednou.
 */
/** Z options vytáhne jen to, co patří do `setViewport` (dotyk, škálování). */
function pickTouch(options = {}) {
  const picked = {};
  for (const key of ['isMobile', 'hasTouch', 'deviceScaleFactor']) {
    if (options[key] !== undefined) picked[key] = options[key];
  }
  return picked;
}

async function launchPuppeteer(options) {
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({
    executablePath: resolveExecutable(),
    // Nový headless umí GPU; starý (`shell`) padá na softwarový raster.
    headless: process.env.ZION_GPU === 'metal' ? 'new' : true,
    args: gpuArgs(),
    ...options,
  });

  return shimBrowser({
    async newPage({ viewport, ...rest } = {}) {
      const page = await browser.newPage();
      // `isMobile`/`hasTouch` patří do `setViewport`, ne do `newPage`
      if (viewport) await page.setViewport({ ...viewport, ...pickTouch(rest) });
      // Playwright umí 'networkidle', puppeteer 'networkidle0'
      const goto = page.goto.bind(page);
      page.goto = (url, opts = {}) =>
        goto(url, { ...opts, waitUntil: opts.waitUntil === 'networkidle' ? 'networkidle0' : opts.waitUntil });
      return shimPage(page);
    },
    close: () => browser.close(),
  });
}
