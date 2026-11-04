#!/usr/bin/env node
/**
 * Test reconnectu (protokol 24).
 *
 * Hráč, kterému spadne socket, drží sedlo `NIRVANA_NET_RESUME_MS`. Když se
 * vrátí s tokenem z `welcome`, dostane **stejné id i místnost** — jinak by
 * výpadek sítě znamenal novou hru (a v tancích cizí tah).
 *
 * Navíc: zpráva z parku (haly) musí dojít i hráči, který sedí v místnosti.
 *
 * Spustit: node apps/nirvana-net/test/resume.mjs (po `npm run build`)
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { PROTO_VERSION as PROTO } from '../dist/nirvana/src/core/net/protocol.js';

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, '..', 'dist', 'nirvana-net', 'src', 'index.js');
const PORT = Number(process.env.RESUME_PORT ?? 4700 + Math.floor(Math.random() * 200));
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
    NIRVANA_NET_ALLOWED_ORIGINS: '',
    ZIS_URL: 'http://127.0.0.1:1',
    // testy nemají ZAP cookie — bez tohohle by každý join skončil pass_required
    NIRVANA_NET_REQUIRE_PASS: '0',
    // krátká grace, aby test nemusel čekat 45 s
    NIRVANA_NET_RESUME_MS: '1200',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
server.stdout.on('data', (c) => { log += c.toString(); });
server.stderr.on('data', (c) => { log += c.toString(); });

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
    send: (m) => socket.send(JSON.stringify(m)),
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

  console.log('\n== reconnect ==');
  const a = client();
  await a.opened;
  a.send({ t: 'hello', proto: PROTO });
  const welcome = await a.waitFor((m) => m.t === 'welcome');
  check('welcome vydá resume token', typeof welcome.resume === 'string' && welcome.resume.length > 8);
  check('první připojení není resume', welcome.resumed !== true);

  a.send({ t: 'join', game: 'tanks' });
  const room = await a.waitFor((m) => m.t === 'room');
  const oldId = room.youPlayerId;
  check('hráč je v místnosti', Boolean(room.room.id) && typeof oldId === 'string');
  const snapBefore = await a.waitFor((m) => m.t === 'snapshot' && m.game === 'tanks');
  check('snapshot chodí', Boolean(snapBefore.tanks));

  // výpadek
  a.close();
  await sleep(300);

  // hráč se vrací s tokenem
  const back = client();
  await back.opened;
  back.send({ t: 'hello', proto: PROTO, resume: welcome.resume });
  const welcome2 = await back.waitFor((m) => m.t === 'welcome');
  check('server potvrdí obnovení', welcome2.resumed === true, String(welcome2.resumed));

  const room2 = await back.waitFor((m) => m.t === 'room');
  check('vrací se do stejné místnosti', room2.room.id === room.room.id, `${room2.room.id} vs ${room.room.id}`);
  check('stejné id hráče (sedlo drží)', room2.youPlayerId === oldId, `${room2.youPlayerId} vs ${oldId}`);

  const snapAfter = await back.waitFor((m) => m.t === 'snapshot' && m.game === 'tanks', 6000);
  check('snapshoty po obnovení chodí dál', Boolean(snapAfter.tanks));

  // hala (park) je slyšet i do místnosti
  const hall = client();
  await hall.opened;
  hall.send({ t: 'hello', proto: PROTO });
  await hall.waitFor((m) => m.t === 'welcome');
  hall.send({ t: 'chat', text: 'haló, hraje někdo?' });
  const heard = await back.waitFor(
    (m) => m.t === 'event' && m.event?.kind === 'chat' && m.event.park === true,
    5000,
  ).catch(() => null);
  check('zpráva z haly dojde do místnosti', Boolean(heard), JSON.stringify(heard?.event ?? null));
  hall.close();

  // po vypršení grace se sedlo uvolní
  back.close();
  await sleep(2000);
  const health = await (await fetch(`http://127.0.0.1:${PORT}/net/health`)).json();
  check('po grace místnost zmizí', health.rooms === 0, JSON.stringify(health));
} catch (error) {
  failures += 1;
  console.log(`  FAIL výjimka — ${error.message}`);
  console.log(log.split('\n').slice(-8).join('\n'));
} finally {
  server.kill('SIGTERM');
  await sleep(200);
}

console.log(`\n${failures === 0 ? 'RESUME OK' : `${failures} CHYB`}`);
process.exit(failures === 0 ? 0 : 1);
