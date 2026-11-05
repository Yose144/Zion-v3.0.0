/**
 * Spuštění appky pro E2E, které ji potřebují.
 *
 * Dvě věci, které každý E2E jinak řeší znovu:
 *  1. **Lokální běh nemá ZAP pas** — `/api/pass` volá archivní oracle, takže se
 *     musí nastavit `ARCHIVE_VERIFY_URL` na lokální stub, který vrátí
 *     `{"valid": true}`. Bez toho brána nepustí dál a test „projde" na
 *     přihlašovací obrazovce.
 *  2. **Appku je potřeba počkat** — `next start` nabíhá několik sekund, a
 *     Puppeteer jinak spadne na `net::ERR_CONNECTION_REFUSED`.
 *
 * Když appka už běží (`FLEET_URL` nebo cokoli na :3010), nic se nespouští.
 */

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

export const ORACLE_PORT = 9099;

/**
 * Stub archivního oracle — vrací „kód je platný" pro jakýkoli vstup.
 * Když už na portu něco sedí (z předchozího běhu), použije se to: opakovaný
 * audit nemá spadnout na `EADDRINUSE`.
 */
async function startOracle() {
  const server = createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ valid: true }));
  });
  const reused = await new Promise((done) => {
    server.once('error', (error) => done(error.code === 'EADDRINUSE'));
    server.listen(ORACLE_PORT, '127.0.0.1', () => done(false));
  });
  return { close: () => (!reused ? server.close() : undefined) };
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/**
 * Vrací `{ base, stop }`. `stop()` uklidí jen to, co skript sám spustil —
 * běžící produkci ani cizí instanci neshazuje.
 */
export async function ensureApp({ base = 'http://127.0.0.1:3010', repo = resolve(import.meta.dirname, '../../..') } = {}) {
  const reachable = await fetch(`${base}/api/health`, { headers: { 'x-render-audit': '1' } })
    .then((res) => res.ok)
    .catch(() => false);

  if (reachable) {
    // Běžící instance může být bez `ARCHIVE_VERIFY_URL` (spuštěná ručně) —
    // pak `/api/pass` volá skutečný oracle a test skončí na bráně. Řekni to
    // nahlas, ať se to nehledá jako „rozbitá hra".
    const verdict = await fetch(`${base}/api/pass`, { headers: { cookie: 'zion_nirvana_pass=ZAP-AUDIT0000000' } })
      .then((res) => res.json())
      .catch(() => ({ access: null }));
    if (!verdict.access) {
      console.warn(
        `! appka na ${base} běží, ale ZAP brána nevrací access:true (${JSON.stringify(verdict)}).\n` +
          '  Ukonči ji (nebo nastav ARCHIVE_VERIFY_URL na stub) — jinak test měří přihlašovací obrazovku.',
      );
    }
    return { base, stop: () => {} };
  }

  const oracle = await startOracle();
  // `npx` se zabíjí špatně: `child.kill()` ukončí jen wrapper a `next-server`
  // zůstane viset na portu (přesně to se stalo — druhý běh auditu pak mluvil
  // se starou instancí bez oracle stubu a test „prošel" na ZAP bráně).
  // Proto se spouští binárka přímo a zabíjí se celá procesní skupina.
  const binary = resolve(repo, 'node_modules/.bin/next');
  const app = spawn(binary, ['start', '-p', '3010'], {
    cwd: resolve(repo, 'apps/nirvana'),
    env: { ...process.env, ZION_RENDER_AUDIT: '1', ARCHIVE_VERIFY_URL: `http://127.0.0.1:${ORACLE_PORT}/verify` },
    stdio: 'ignore',
    detached: true,
  });

  for (let attempt = 0; attempt < 90; attempt += 1) {
    const ok = await fetch(`${base}/api/health`, { headers: { 'x-render-audit': '1' } })
      .then((res) => res.ok)
      .catch(() => false);
    if (ok) break;
    await sleep(1000);
  }

  return {
    base,
    stop: () => {
      try {
        process.kill(-app.pid);
      } catch {
        app.kill();
      }
      oracle.close();
    },
  };
}

/** Pas, který middleware jen kontroluje na přítomnost; platnost ověří stub oracle. */
export const PASS_COOKIE = { name: 'zion_nirvana_pass', value: 'ZAP-AUDIT0000000' };

/** Nastaví cookie oběma cestami (Playwright i Puppeteer mají jiné API). */
export async function grantPass(page, host) {
  await page.context?.().addCookies?.([{ ...PASS_COOKIE, domain: host, path: '/' }]);
  await page.setCookie?.({ ...PASS_COOKIE, domain: host, path: '/' });
}
