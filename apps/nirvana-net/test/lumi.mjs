#!/usr/bin/env node
/**
 * Test společného létání v Lumi.
 *
 * Lumi je **relay** hra: klient počítá svůj let sám a server ho předává
 * ostatním. Test proto ověřuje přesně to, co má server opravdu na starosti:
 *  1. dva lidé se potkají v jedné místnosti a vidí se navzájem,
 *  2. sebraná světla jsou **sdílená** (jedno světlo = jedno id v místnosti),
 *  3. svatyně se otevře, až když je má všech sedm (bez ohledu na to, kdo je
 *     sebral), a nový hráč dostane už sebraná světla,
 *  4. cesta místnosti se bere z prvního `join` a nemění se pod rukama,
 *  5. odchod jednoho nezhroutí druhému snapshot.
 *
 * Spustit: node apps/nirvana-net/test/lumi.mjs (po `npm run build`)
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { PROTO_VERSION as PROTO } from '../dist/nirvana/src/core/net/protocol.js';

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, '..', 'dist', 'nirvana-net', 'src', 'index.js');
const PORT = Number(process.env.LUMI_PORT ?? 5100 + Math.floor(Math.random() * 200));
const WS_URL = `ws://127.0.0.1:${PORT}/net`;

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

const server = spawn(process.execPath, [entry], {
  env: {
    ...process.env,
    NIRVANA_NET_PORT: String(PORT),
    NIRVANA_NET_ALLOWED_ORIGINS: 'http://127.0.0.1:3055',
    ZIS_URL: 'http://127.0.0.1:1',
    NIRVANA_NET_REQUIRE_PASS: '0',
    NIRVANA_NET_RESUME_MS: '0',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
server.stdout.on('data', (chunk) => {
  log += chunk.toString();
});
server.stderr.on('data', (chunk) => {
  log += chunk.toString();
});

function client() {
  const socket = new WebSocket(WS_URL);
  socket.on('error', () => {});
  const inbox = [];
  socket.on('message', (data) => inbox.push(JSON.parse(data.toString())));
  const opened = new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  opened.catch(() => {});
  return {
    socket,
    inbox,
    opened,
    send: (message) => socket.send(JSON.stringify(message)),
    last(match) {
      return [...inbox].reverse().find(match) ?? null;
    },
    async waitFor(match, ms = 6000) {
      const started = Date.now();
      for (;;) {
        const found = this.last(match);
        if (found) return found;
        if (Date.now() - started > ms) throw new Error('timeout');
        await sleep(40);
      }
    },
    close: () => socket.close(),
  };
}

const state = (x, y, extra = {}) => ({ t: 'fly', x, y, vx: 1, vy: 0.5, energy: 80, ...extra });

try {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/net/health`);
      if (response.ok) break;
    } catch {
      /* start */
    }
    await sleep(100);
  }

  console.log('\n== Lumi: společné létání ==');
  const a = client();
  await a.opened;
  a.send({ t: 'hello', proto: PROTO });
  await a.waitFor((m) => m.t === 'welcome');
  a.send({ t: 'join', game: 'lumi', path: 'wind' });
  const roomA = await a.waitFor((m) => m.t === 'room');
  check('první letí', roomA.room.game === 'lumi' && roomA.room.players === 1, JSON.stringify(roomA.room));

  a.send(state(20, 30));
  const firstShot = await a.waitFor((m) => m.t === 'snapshot' && m.game === 'lumi');
  check('snapshot nese cestu', firstShot.lumi?.path === 'wind', JSON.stringify(firstShot.lumi));
  check('na startu nikdo jiný nelétá', (firstShot.lumi?.flyers ?? []).length === 0);

  const b = client();
  await b.opened;
  b.send({ t: 'hello', proto: PROTO });
  await b.waitFor((m) => m.t === 'welcome');
  b.send({ t: 'join', game: 'lumi', room: roomA.room.id, path: 'calm' });
  const roomB = await b.waitFor((m) => m.t === 'room');
  check('druhý se přidal do stejné místnosti', roomB.room.id === roomA.room.id, roomB.room.id);

  b.send(state(44, 55));
  // Čeká se na **pozici**, ne na první výskyt: hráč se ve snapshotu objeví
  // dřív, než dorazí jeho `fly` (spawn 10,12) — test by pak měřil spawn.
  const aSeesB = await a.waitFor(
    (m) =>
      m.t === 'snapshot' &&
      (m.lumi?.flyers ?? []).some((flyer) => flyer.id === roomB.youPlayerId && flyer.x === 44),
    6000,
  );
  const bFlyer = aSeesB.lumi.flyers.find((flyer) => flyer.id === roomB.youPlayerId);
  check('první vidí druhého', Boolean(bFlyer) && bFlyer.x === 44, JSON.stringify(bFlyer));
  check('pozice se předává', bFlyer.y === 55, String(bFlyer?.y));

  const bSeesA = await b.waitFor(
    (m) => m.t === 'snapshot' && (m.lumi?.flyers ?? []).some((flyer) => flyer.id === roomA.youPlayerId),
  );
  check('druhý vidí prvního', Boolean(bSeesA.lumi.flyers.find((flyer) => flyer.id === roomA.youPlayerId)));

  // sdílená světla
  b.send(state(44, 55, { collect: 1 }));
  const shared = await a.waitFor((m) => m.t === 'snapshot' && (m.lumi?.lights ?? []).includes(1), 5000);
  check('světlo je společné pro místnost', shared.lumi.lights.includes(1), JSON.stringify(shared.lumi.lights));

  // ── L-6: předání světla spolulentci ────────────────────────────────
  b.send({ t: 'handoff', light: 1 });
  const gift = await a
    .waitFor((m) => m.t === 'event' && m.event.kind === 'gift', 4000)
    .catch(() => null);
  check('druhý dostane světlo darem (event)', Boolean(gift), JSON.stringify(gift?.event));
  check('dar má správného dárce i příjemce', gift?.event.from === roomB.youPlayerId && gift?.event.to === roomA.youPlayerId, JSON.stringify(gift?.event));
  check('dar nese jméno dárce', typeof gift?.event.fromName === 'string' && gift.event.fromName.length > 0, String(gift?.event.fromName));

  // dar vidí i ostatní: B má ve svém snapshotu A s `gifts: 1`
  const giftsSeen = await b
    .waitFor(
      (m) =>
        m.t === 'snapshot' &&
        (m.lumi?.flyers ?? []).some((flyer) => flyer.id === roomA.youPlayerId && flyer.gifts === 1),
      4000,
    )
    .catch(() => null);
  check('server vidí dar ve flyers', Boolean(giftsSeen), JSON.stringify(giftsSeen?.lumi?.flyers));

  // světlo, které sám neseberu, darovat nejde
  const before = a.inbox.filter((m) => m.t === 'event' && m.event.kind === 'gift').length;
  a.send({ t: 'handoff', light: 5 });
  a.send({ t: 'handoff', light: 1 });
  await sleep(700);
  const after = a.inbox.filter((m) => m.t === 'event' && m.event.kind === 'gift').length;
  check('darovat cizí (nebo už darované) světlo nejde', after === before, `${before} → ${after}`);

  // nový hráč dostane už sebraná světla
  const c = client();
  await c.opened;
  c.send({ t: 'hello', proto: PROTO });
  await c.waitFor((m) => m.t === 'welcome');
  c.send({ t: 'join', game: 'lumi', room: roomA.room.id });
  const cShot = await c.waitFor((m) => m.t === 'snapshot' && m.game === 'lumi');
  check('nový hráč vidí sebraná světla', (cShot.lumi?.lights ?? []).includes(1), JSON.stringify(cShot.lumi?.lights));
  check('cesta se nemění pod rukama', cShot.lumi?.path === 'wind', String(cShot.lumi?.path));

  // svatyně se otevře až po sedmi
  for (let id = 2; id <= 6; id += 1) a.send(state(20, 30, { collect: id }));
  await sleep(300);
  const partial = await a.waitFor((m) => m.t === 'snapshot' && (m.lumi?.lights ?? []).length === 6, 5000);
  check('šest světel svatyni neotevře', partial.lumi.open === false, JSON.stringify(partial.lumi.lights));

  a.send(state(20, 30, { collect: 7, finished: true }));
  const opened = await a.waitFor((m) => m.t === 'snapshot' && m.lumi?.open === true, 5000);
  check('sedmé světlo otevře svatyni', opened.lumi.open === true, JSON.stringify(opened.lumi.lights));
  check('sebrali je různí lidé — pořád se počítají', opened.lumi.lights.length === 7, JSON.stringify(opened.lumi.lights));

  const finished = await b.waitFor(
    (m) => m.t === 'snapshot' && (m.lumi?.flyers ?? []).some((flyer) => flyer.id === roomA.youPlayerId && flyer.finished),
    5000,
  ).catch(() => null);
  check('druhý vidí, že první doletěl', Boolean(finished));

  // odchod jednoho nesmí rozbít druhého
  c.close();
  await sleep(400);
  b.send(state(30, 40));
  const afterLeave = await b.waitFor((m) => m.t === 'snapshot' && m.game === 'lumi', 5000).catch(() => null);
  check('po odchodu třetího druhý dostává snapshoty', Boolean(afterLeave));

  // ── L-2: duch (odpojený letce ještě 3 s na obloze) ────────────────
  b.send(state(52, 60));
  await a.waitFor(
    (m) => m.t === 'snapshot' && (m.lumi?.flyers ?? []).some((f) => f.id === roomB.youPlayerId && f.x === 52),
    5000,
  );
  b.close();
  const ghost = await a
    .waitFor(
      (m) => m.t === 'snapshot' && (m.lumi?.flyers ?? []).some((f) => f.id === roomB.youPlayerId && f.ghost === true),
      3000,
    )
    .catch(() => null);
  check('odpojený letce zůstane jako duch', Boolean(ghost));
  const ghostFlyer = (ghost?.lumi?.flyers ?? []).find((f) => f.id === roomB.youPlayerId);
  check('duch sedí na poslední pozici', ghostFlyer?.x === 52 && ghostFlyer?.y === 60, JSON.stringify(ghostFlyer));

  await sleep(3600);
  const settled = a.last((m) => m.t === 'snapshot' && m.game === 'lumi');
  check(
    'duch po 3 s zmizí',
    !(settled?.lumi?.flyers ?? []).some((f) => f.id === roomB.youPlayerId),
    JSON.stringify(settled?.lumi?.flyers),
  );

  a.close();
} catch (error) {
  failures += 1;
  console.log(`  FAIL výjimka: ${error.message}`);
  console.log(log.split('\n').slice(-12).join('\n'));
} finally {
  await sleep(200);
  server.kill('SIGTERM');
}

console.log('');
if (failures > 0) {
  console.log(`LUMI FAILED (${failures})`);
  process.exit(1);
}
console.log('LUMI OK');
