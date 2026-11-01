// E2E: Mars aréna — Q3 sestava ve dvou headless prohlížečích.
//
// Ověřuje cestu, kterou net testy nepokryjí: **klient** se připojí přes proto 4,
// dostane 3 boty (`isBot`), vykreslí je jako vzdálené hráče a neutíkají mu
// struktury. Předpoklady: služba na :3011 (NIRVANA_ARENA_BOTS=3) a appko
// `next start -p 3010` builduté s NEXT_PUBLIC_NIRVANA_NET_URL=ws://127.0.0.1:3011/net.
//
// Spustit:  node apps/nirvana/e2e/mars-arena.mjs

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  ({ chromium } = require(process.env.PLAYWRIGHT_MODULE ??
    '/Users/yeshuae/.nvm/versions/node/v20.19.6/lib/node_modules/playwright'));
}

const BASE = process.env.MARS_BASE ?? 'http://127.0.0.1:3010';
const EXE =
  process.env.CHROME_PATH ??
  '/Users/yeshuae/.cache/puppeteer/chrome-headless-shell/mac_arm-156.0.8078.47/chrome-headless-shell-mac-arm64/chrome-headless-shell';

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const debug = (page) => page.evaluate(() => window.__mpDebug?.() ?? null);
const poll = async (page, predicate, timeoutMs = 120_000) => {
  const started = Date.now();
  for (;;) {
    const state = await debug(page);
    if (state && predicate(state)) return state;
    if (Date.now() - started > timeoutMs) return null;
    await sleep(250);
  }
};

const browser = await chromium.launch({
  executablePath: EXE,
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
});

const errors = [];
function watch(page, tag) {
  page.on('pageerror', (error) => errors.push(`${tag} pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (/401|404|favicon|net::ERR/.test(text)) return;
    errors.push(`${tag} console: ${text}`);
  });
}

try {
  const a = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  watch(a, 'A');

  await a.goto(`${BASE}/mars?arenaDebug=1`, { waitUntil: 'networkidle' });
  check('stránka /mars se načte', true);

  await a.getByRole('button', { name: /Multiplayer/i }).click();

  // swiftshader žere minuty — R3F mountuje až po GL init
  const state = await poll(a, (s) => s.connected && (s.players?.length ?? 0) >= 4, 150_000);
  check('MP připojen (proto 4 handshake)', Boolean(state?.connected), JSON.stringify(state?.you ?? null));

  const bots = (state?.players ?? []).filter((p) => p.isBot);
  const humans = (state?.players ?? []).filter((p) => !p.isBot);
  check('klient vidí 3 boty', bots.length === 3, `boti=${bots.length} celkem=${state?.players?.length}`);
  check('klient ví, kdo je bot', bots.every((p) => typeof p.isBot === 'boolean'), JSON.stringify(bots.map((p) => p.id)));
  check('člověk je jeden', humans.length === 1 && humans[0].id === state.you, JSON.stringify(humans.map((p) => p.id)));
  check('boti mají jména', bots.every((p) => p.name && p.name !== '…'), JSON.stringify(bots.map((p) => p.name)));

  // ── boti se hýbou i v klientovi (přes snapshoty) ──────────────────
  const start = bots.map((p) => ({ id: p.id, x: p.x, z: p.z }));
  const later = await poll(a, () => true, 4000);
  const moved = start.map((s) => {
    const now = (later?.players ?? []).find((p) => p.id === s.id);
    return now ? Math.hypot(now.x - s.x, now.z - s.z) : 0;
  });
  check('boti se hýbou v klientovi', moved.some((d) => d > 0.5), moved.map((d) => d.toFixed(1)).join('/'));

  // ── zbraň: server posílá MG (2) a munici ──────────────────────────
  const hasWeaponData = (state?.players ?? []).every((p) => typeof p.weapon === 'number' && typeof p.ammo === 'number');
  check('snapshot nese zbraň i munici', hasWeaponData,
    JSON.stringify((state?.players ?? []).map((p) => ({ w: p.weapon, a: p.ammo }))));

  await sleep(500);
  await a.screenshot({ path: '.artifacts/render/mars-q3-20261101/mp-bots.png' }).catch(() => {});
  check('bez JS chyb', errors.length === 0, errors.join(' | '));

  await a.close();
} catch (error) {
  check('E2E nespadlo', false, String(error));
  console.log(errors.join('\n'));
} finally {
  await browser.close();
}

console.log(`\nmars-e2e: ${failures === 0 ? 'PASSED' : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
