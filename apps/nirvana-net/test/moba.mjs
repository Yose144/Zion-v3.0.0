#!/usr/bin/env node
/**
 * Test serverové MOBA „První svět" (multiplayer, velikost týmu drží server)
 * — bez prohlížeče. Test je záměrně **nezávislý na počtu hrdinů**: server
 * rozhoduje, kolik jich je (3v3/5v5), test jen ověří, že to sedí a že obě
 * strany jsou vyrovnané.
 *
 * Server drží simulaci; test posílá jen vstupy a kontroluje snapshoty.
 * Ověřuje: místnost, doplnění botů, start po odpočtu, pohyb, kouzlo,
 * převzetí uzlu L5, konec a úklid po odpojení.
 *
 * Spustit: node apps/nirvana-net/test/moba.mjs (po `npm run build`)
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { PROTO_VERSION as PROTO } from '../dist/nirvana/src/core/net/protocol.js';

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, '..', 'dist', 'nirvana-net', 'src', 'index.js');
const PORT = Number(process.env.MOBA_PORT ?? 3800 + Math.floor(Math.random() * 400));
const WS_URL = `ws://127.0.0.1:${PORT}/net`;


let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

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
    async waitFor(match, ms = 8000) {
      const started = Date.now();
      for (;;) {
        const found = this.last(match);
        if (found) return found;
        if (Date.now() - started > ms) throw new Error('timeout waiting for message');
        await sleep(40);
      }
    },
    close: () => socket.close(),
  };
}

const server = spawn(process.execPath, [entry], {
  env: {
    ...process.env,
    NIRVANA_NET_PORT: String(PORT),
    NIRVANA_NET_ALLOWED_ORIGINS: 'http://127.0.0.1:3999',
    ZIS_URL: 'http://127.0.0.1:1',
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
const exited = new Promise((resolve) => server.once('exit', (code) => resolve(code)));

async function waitForHealth() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const state = await Promise.race([exited, sleep(100).then(() => 'running')]);
    if (state !== 'running') throw new Error(`služba spadla (exit ${state}):\n${log}`);
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/net/health`);
      if (response.ok) return;
    } catch {
      // ještě nabíhá
    }
  }
  throw new Error(`služba nenaběhla:\n${log}`);
}


/** Dojdi k bodu — server je autorita, takže posíláme vstup a čteme snapshoty. */
async function walkTo(client, youId, x, z, steps = 140) {
  for (let index = 0; index < steps; index += 1) {
    const snapshot = client.last((m) => m.t === 'snapshot' && m.game === 'moba')?.moba;
    const me = snapshot?.heroes.find((hero) => hero.id === youId);
    if (!me) return null;
    if (!me.alive) {
      await sleep(150);
      continue;
    }
    const dx = x - me.x;
    const dz = z - me.z;
    const length = Math.hypot(dx, dz) || 1;
    if (length < 2.5) {
      // zastav: poslední vstup by jinak hrdinu táhl dál z dosahu
      client.send({
        t: 'input',
        seq: 9999,
        mx: 0,
        mz: 0,
        yaw: 0,
        pitch: 0,
        jump: false,
        fire: false,
        weapon: 0,
      });
      return me;
    }
    client.send({
      t: 'input',
      seq: index,
      mx: dx / length,
      mz: dz / length,
      yaw: 0,
      pitch: 0,
      jump: false,
      fire: false,
      weapon: 0,
    });
    await sleep(90);
  }
  return client.last((m) => m.t === 'snapshot' && m.game === 'moba')?.moba.heroes.find((hero) => hero.id === youId) ?? null;
}

try {
  await waitForHealth();
  console.log(`\n== MOBA na :${PORT} ==`);

  const a = client();
  const b = client();
  await a.opened;
  await b.opened;
  a.send({ t: 'hello', proto: PROTO });
  b.send({ t: 'hello', proto: PROTO });
  await a.waitFor((m) => m.t === 'welcome');
  await b.waitFor((m) => m.t === 'welcome');

  a.send({ t: 'join', game: 'moba', heroId: 0 });
  b.send({ t: 'join', game: 'moba', heroId: 82 });
  const roomA = await a.waitFor((m) => m.t === 'room');
  const roomB = await b.waitFor((m) => m.t === 'room');
  check('místnost: dva lidi', roomB.occupants.length === 2, String(roomB.occupants.length));
  check('místnost: hra moba', roomA.room.game === 'moba', roomA.room.game);
  const maxPlayers = roomA.room.maxPlayers;
  check(
    'místnost: kapacita sudá a aspoň 2',
    typeof maxPlayers === 'number' && maxPlayers >= 2 && maxPlayers % 2 === 0,
    String(maxPlayers),
  );
  check('místnost: youPlayerId', Boolean(roomA.youPlayerId && roomB.youPlayerId));

  // čekáme na odpočet + start (boti se doplní)
  const started = await a.waitFor(
    (m) => m.t === 'snapshot' && m.game === 'moba' && m.moba?.heroes?.length >= 2 && m.state === 'running',
    25_000,
  );
  // S mlhou války nevidí hráč celou mapu — vidí **svůj tým** (a to, co
  // jeho jednotky skutečně vidí). Test to musí respektovat, jinak by
  // vyžadoval cheat.
  const meA = started.moba.heroes.find((hero) => hero.id === roomA.youPlayerId);
  check('start: hráč A je ve hře', Boolean(meA), roomA.youPlayerId ?? 'null');
  check('start: tři uzly L5', started.moba.nodes.length === 3);
  check('start: struktury jdou vidět vždy', started.moba.towers.length >= 26, String(started.moba.towers.length));

  const teamA = meA.team;
  const ownTeam = started.moba.heroes.filter((hero) => hero.team === teamA);
  check(
    `mlha: A vidí celý svůj tým (${maxPlayers / 2})`,
    ownTeam.length === maxPlayers / 2,
    String(ownTeam.length),
  );
  // Na startu stojí armády proti sobě (~76 m), takže soupeře vidět NEMÁ.
  const enemyVisible = started.moba.heroes.filter((hero) => hero.team !== teamA);
  check('mlha: soupeře na druhé straně mapy nevidím', enemyVisible.length === 0, String(enemyVisible.length));

  // Protistrana vidí svůj tým, ne ten náš — každý dostává jiný snapshot.
  const startedB = await b.waitFor(
    (m) => m.t === 'snapshot' && m.game === 'moba' && m.state === 'running',
    25_000,
  );
  const meB = startedB.moba.heroes.find((hero) => hero.id === roomB.youPlayerId);
  check('mlha: B vidí sám sebe', Boolean(meB));
  check(
    'mlha: B nevidí hrdinu A',
    !startedB.moba.heroes.some((hero) => hero.id === roomA.youPlayerId),
    startedB.moba.heroes.map((hero) => hero.id).join(','),
  );

  // obchod: server kupuje jen když je zlato (start 320 < 400 na sandály)
  const goldStart = meA.gold;
  a.send({ t: 'buy', item: 'boots' });
  await sleep(400);
  const afterBuy = a.last((m) => m.t === 'snapshot' && m.game === 'moba').moba.heroes.find((hero) => hero.id === roomA.youPlayerId);
  // zlato roste pasivně (F1), takže se neporovnává přesně — jen že se neutratilo
  check('obchod: bez zlata nic nekoupí', afterBuy.items.length === 0 && afterBuy.gold <= goldStart + 3, `${afterBuy.gold} / ${afterBuy.items.length}`);

  // server buy handler: Tesák stojí 300, na začátku je 320 → musí projít
  a.send({ t: 'buy', item: 'fang' });
  await sleep(600);
  const withFang = a.last((m) => m.t === 'snapshot' && m.game === 'moba').moba.heroes.find((hero) => hero.id === roomA.youPlayerId);
  check('obchod: server nákup opravdu provede', withFang.items.includes('fang'), withFang.items.join(','));

  // prodej: 60 % z ceny (300 → 180)
  const goldBeforeSell = withFang.gold;
  a.send({ t: 'sell', item: 'fang' });
  await sleep(600);
  const afterSell = a.last((m) => m.t === 'snapshot' && m.game === 'moba').moba.heroes.find((hero) => hero.id === roomA.youPlayerId);
  check('obchod: prodej item odebere', !afterSell.items.includes('fang'), afterSell.items.join(','));
  check('obchod: prodej vrátí zlato', afterSell.gold > goldBeforeSell, `${goldBeforeSell} → ${afterSell.gold}`);

  // emote: server ho má přeposlat jako event celé místnosti
  a.send({ t: 'emote', id: 2 });
  await sleep(400);
  const emoteEvent = a.last((m) => m.t === 'event' && m.event?.kind === 'emote');
  check(
    'emote: server přepošle bublinu',
    emoteEvent?.event?.emote === 2 && emoteEvent.event.playerId === roomA.youPlayerId,
    JSON.stringify(emoteEvent?.event ?? null),
  );

  // pohyb: posílat vstup a čekat, až se pozice změní
  const startX = meA.x;
  const startZ = meA.z;
  for (let index = 0; index < 20; index += 1) {
    a.send({ t: 'input', seq: index, mx: 1, mz: 0, yaw: 0, pitch: 0, jump: false, fire: false, weapon: 0 });
    await sleep(50);
  }
  await sleep(400);
  const moved = a
    .last((m) => m.t === 'snapshot' && m.game === 'moba')
    ?.moba.heroes.find((hero) => hero.id === roomA.youPlayerId);
  check('pohyb: server posunul hrdinu', Math.hypot(moved.x - startX, moved.z - startZ) > 0.4, `${startX},${startZ} → ${moved.x},${moved.z}`);

  // uzel L5: dojdi na Kailash (-12/-26) a chvíli tam stůj (blízko modré)
  const atNode = await walkTo(a, roomA.youPlayerId, -12, -26, 220);
  console.log(`    (poloha po chůzi: ${atNode ? `${Math.round(atNode.x)},${Math.round(atNode.z)} hp=${Math.round(atNode.hp)}` : 'null'})`);
  await sleep(3400);
  const captured = a.last((m) => m.t === 'snapshot' && m.game === 'moba');
  console.log('    (uzly:', JSON.stringify(captured.moba.nodes.map((n) => ({ k: n.key, o: n.owner, p: n.progress }))), ')');
  check(
    'uzel L5: převzat po stání',
    captured.moba.nodes.some((node) => node.owner === 'blue'),
    JSON.stringify(captured.moba.nodes.map((node) => node.owner)),
  );

  // kouzlo: sešli Q na nepřátelského miniona. Vlny jsou od F19 rychlejší
  // (18 s, 4 minioni), takže u uzlu nemusí být zrovna žádný — test proto
  // k nejbližšímu dojde, místo aby čekal na náhodu.
  let target = null;
  for (let index = 0; index < 40 && !target; index += 1) {
    const snapshot = a.last((m) => m.t === 'snapshot' && m.game === 'moba')?.moba;
    const me = snapshot?.heroes.find((hero) => hero.id === roomA.youPlayerId);
    const minions = snapshot?.minions.filter((candidate) => candidate.team === 'red') ?? [];
    if (!me || minions.length === 0) {
      await sleep(250);
      continue;
    }
    const nearest = [...minions].sort(
      (left, right) =>
        Math.hypot(left.x - me.x, left.z - me.z) - Math.hypot(right.x - me.x, right.z - me.z),
    )[0];
    if (Math.hypot(nearest.x - me.x, nearest.z - me.z) < 10) {
      target = nearest;
      break;
    }
    await walkTo(a, roomA.youPlayerId, nearest.x, nearest.z, 30);
  }
  check('kouzlo: nepřátelský minion v dosahu', Boolean(target));
  if (target) {
    const snapBefore = a.last((m) => m.t === 'snapshot' && m.game === 'moba').moba;
    const before = snapBefore.heroes.find((hero) => hero.id === roomA.youPlayerId);
    console.log('    (cast:', JSON.stringify({ hero: { x: before.x, z: before.z, alive: before.alive, mana: before.mana }, target: { x: target.x, z: target.z }, dist: Math.round(Math.hypot(before.x - target.x, before.z - target.z)) }), ')');
    // Projektil žije jen dokud něco netrefí — na blízkého miniona to může být
    // pod 500 ms, takže `length > 0` v jednom vzorku padalo podle štěstí
    // (reálně 1 ze 3 běhů). Deterministicky: stačí, že byl v některém
    // snapshotu po seslání.
    const castFrom = a.inbox.length;
    a.send({
      t: 'input',
      seq: 99,
      mx: 0,
      mz: 0,
      yaw: 0,
      pitch: 0,
      jump: false,
      fire: false,
      weapon: 0,
      castSlot: 'Q',
      castX: target.x,
      castZ: target.z,
    });
    // Projektil žije jen dokud něco netrefí — na blízkého miniona to může být
    // pod 500 ms, a pak by `length > 0` v jednom vzorku padalo podle štěstí
    // (reálně flakovalo 1 ze 3 běhů). Deterministicky: stačí, že byl
    // v některém snapshotu po seslání.
    await sleep(500);
    const sawProjectile = a.inbox
      .slice(castFrom)
      .some((m) => m.t === 'snapshot' && m.game === 'moba' && m.moba.projectiles.length > 0);
    const after = a.last((m) => m.t === 'snapshot' && m.game === 'moba').moba;
    const meAfter = after.heroes.find((hero) => hero.id === roomA.youPlayerId);
    // Server kouzlo přijal: mana spadla a běží cooldown. Samotný zásah závisí
    // na tom, jestli projektil miniona trefí (minion se hýbe) — proto se tu
    // netestuje smrt, ale že se kouzlo opravdu spustilo na serveru.
    check(
      'kouzlo: server přijal Q (mana + cooldown)',
      meAfter.mana < before.mana && meAfter.cooldowns.Q > 0,
      `mana ${before.mana} → ${meAfter.mana}, cd ${meAfter.cooldowns.Q}`,
    );
    check('kouzlo: projektil je ve snapshotu', sawProjectile || after.projectiles.length > 0, `viděn=${sawProjectile}, na konci=${after.projectiles.length}`);
  }

  // úklid: odpojení A → místnost má o hráče méně
  a.close();
  await sleep(800);
  b.send({ t: 'leave' });
  await sleep(600);
  const health = await (await fetch(`http://127.0.0.1:${PORT}/net/health`)).json();
  check('úklid: místnosti zmizely', health.rooms === 0, JSON.stringify(health.rooms));
  b.close();
} finally {
  server.kill('SIGTERM');
  await sleep(300);
  if (!server.killed) server.kill('SIGKILL');
}

console.log(`\n${failures === 0 ? 'VŠE OK' : `${failures} CHYB`}`);
process.exit(failures === 0 ? 0 : 1);
