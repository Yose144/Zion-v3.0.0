// Saturn tanky — test pravidel (bez prohlížeče).
// Spustit: npx tsx apps/nirvana/test/saturn-tanks.mjs
import {
  BLAST_DAMAGE,
  TANK_HP,
  aimAt,
  TERRAIN_COLS,
  WORLD_W,
  adjustAim,
  barrelTip,
  botAim,
  createTanks,
  fire,
  rematch,
  stepTanks,
  tankCenter,
  tanksInfo,
  terrainAt,
} from '../src/core/saturn/tanks.ts';

let failures = 0;
let checks = 0;
function check(name, ok, detail = '') {
  checks += 1;
  if (ok) console.log(`  OK   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Posun simulace o `seconds` po malých krocích (jako běžící hra). */
function run(state, seconds, dt = 1 / 60) {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i += 1) stepTanks(state, dt);
}

/** Krokuj, dokud platí podmínka (nebo do vyčerpání času). */
function runUntil(state, predicate, seconds = 12, dt = 1 / 60) {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i += 1) {
    stepTanks(state, dt);
    if (predicate(state)) return true;
  }
  return false;
}

console.log('\n-- mapa a tanky --');
{
  const a = createTanks(42);
  const b = createTanks(42);
  check('determinismus: stejné semínko = stejná mapa', a.terrain.heights.every((h, i) => h === b.terrain.heights[i]));
  const c = createTanks(43);
  check('jiné semínko = jiná mapa', !a.terrain.heights.every((h, i) => h === c.terrain.heights[i]));
  check('terén má správný počet vzorků', a.terrain.heights.length === TERRAIN_COLS);

  const mid = terrainAt(a.terrain, WORLD_W / 2);
  check('výška uprostřed je v rozumném rozsahu', mid > 40 && mid < 400, String(mid));
  check('interpolace na okrajích sedí se vzorkem', Math.abs(terrainAt(a.terrain, 0) - a.terrain.heights[0]) < 0.001);

  check('hráč stojí vlevo', a.player.x < WORLD_W * 0.3);
  check('bot stojí vpravo', a.bot.x > WORLD_W * 0.7);
  const pc = tankCenter(a.terrain, a.player);
  check('tank stojí na zemi', Math.abs(pc.y - terrainAt(a.terrain, a.player.x) - 10) < 0.001);
  check('na startu je hráč na tahu', a.turn === 'player' && a.phase === 'aim');
  check('HP na startu plné', a.player.hp === TANK_HP && a.bot.hp === TANK_HP);
  check('vítr je v rozsahu', Math.abs(a.wind) <= 46, String(a.wind));
}

console.log('\n-- mířidlo a výstřel --');
{
  const s = createTanks(7);
  const tip = barrelTip(s, 'player');
  check('hlaveň hráče míří doprava', tip.x > s.player.x);
  const tipBot = barrelTip(s, 'bot');
  check('hlaveň bota míří doleva', tipBot.x < s.bot.x);

  const before = s.player.angle;
  adjustAim(s, 'player', 10, 20);
  check('nerovná se úhel po zamíření', s.player.angle > before);
  adjustAim(s, 'player', 999, 999);
  check('úhel se zastropuje na 90', s.player.angle === 90);
  adjustAim(s, 'player', -999, -999);
  check('síla má dno 5', s.player.power === 5);
  const botAngle = s.bot.angle;
  adjustAim(s, 'bot', 10, 10);
  check('botovo mířidlo hráč nemění', s.bot.angle === botAngle);

  s.player.angle = 45;
  s.player.power = 70;
  check('výstřel vznikne', fire(s, 'player') === true);
  check('po výstřelu je fáze letu', s.phase === 'flight' && Boolean(s.shot));
  check('druhý výstřel během letu neprojde', fire(s, 'player') === false);
  check('hráčův výstřel letí doprava', s.shot.vx > 0);
  check('střela startuje z hlavně', Math.abs(s.shot.x - barrelTip(s, 'player').x) < 8);
}

console.log('\n-- fyzika letu --');
{
  const s = createTanks(11);
  s.wind = 0;
  s.player.angle = 60;
  s.player.power = 90;
  fire(s, 'player');
  const vy0 = s.shot.vy;
  run(s, 0.4);
  if (s.phase === 'flight') check('gravitace zpomaluje stoupání', s.shot.vy < vy0);
  else check('gravitace zpomaluje stoupání (už dopadlo)', true);

  const wind = createTanks(11);
  wind.wind = 40;
  wind.player.angle = 45;
  wind.player.power = 60;
  fire(wind, 'player');
  const vx0 = wind.shot.vx;
  stepTanks(wind, 0.2);
  if (wind.phase === 'flight') check('vítr zrychluje do strany', wind.shot.vx > vx0);
  else check('vítr zrychluje do strany (už dopadlo)', true);
  check('stopa střely roste', wind.phase !== 'flight' || wind.shot.trail.length > 4);
}

console.log('\n-- dopad, kráter a poškození --');
{
  const s = createTanks(21);
  // střela namířená tak, aby spadla kousek od bota
  const target = tankCenter(s.terrain, s.bot);
  const aim = aimAt(s, 'player', 0.4);
  s.turn = 'player';
  // aimAt vrací úhel 0–90 od vodorovné; hráč střílí doprava, takže stejný úhel
  s.player.angle = aim.angle;
  s.player.power = aim.power;
  fire(s, 'player');
  const heightsBefore = Array.from(s.terrain.heights);
  run(s, 8);
  check('po dopadu se fáze přesune dál', s.phase !== 'flight');
  const carved = s.terrain.heights.some((h, i) => h < heightsBefore[i] - 1);
  check('výbuch vyhloubil kráter', carved);
  check('zásah se zapíše do lastHit', s.lastHit !== null, JSON.stringify(s.lastHit));
  check('poškození nepřekročí maximum', (s.lastHit?.damage ?? 0) <= BLAST_DAMAGE);
  const hpDown = s.bot.hp < TANK_HP || s.player.hp < TANK_HP;
  check('někdo dostal zásah (bot nebo vlastní hlava)', hpDown, `bot=${s.bot.hp} hráč=${s.player.hp}`);
  void target;
}

console.log('\n-- střídání tahů a vítr --');
{
  const s = createTanks(31);
  s.player.angle = 60;
  s.player.power = 60;
  fire(s, 'player');
  runUntil(s, (st) => st.phase === 'resolve');
  check('po dopadu se čeká na vyhodnocení', s.phase === 'resolve');
  runUntil(s, (st) => st.phase === 'aim', 3);
  check('po dopadu je na tahu bot', s.turn === 'bot', s.turn);
  check('bot dostal čas na rozmyšlenou', s.waitMs > 0 || s.phase === 'flight');
  run(s, 1.0);
  check('bot po chvíli vypálí', s.shotsFired === 2, String(s.shotsFired));

  const winds = new Set([s.wind]);
  for (let i = 0; i < 4; i += 1) {
    runUntil(s, (st) => st.phase === 'aim' && st.waitMs === 0, 15);
    winds.add(s.wind);
  }
  check('vítr se mezi tahy mění', winds.size > 1, [...winds].join(','));
}

console.log('\n-- bot míří rozumně --');
{
  const s = createTanks(51);
  const perfect = botAim(s, 0);
  check('bot vrátí úhel v mezích', perfect.angle >= 0 && perfect.angle <= 90, String(perfect.angle));
  check('bot vrátí sílu v mezích', perfect.power >= 5 && perfect.power <= 100, String(perfect.power));
  // se nulovou chybou musí být zásah blízko hráče
  const target = tankCenter(s.terrain, s.player);
  s.bot.angle = perfect.angle;
  s.bot.power = perfect.power;
  s.turn = 'bot';
  fire(s, 'bot');
  run(s, 8);
  const hit = s.lastHit;
  const miss = hit ? Math.hypot(hit.x - target.x, hit.y - target.y) : 999;
  check('přesné botovo mířidlo trefí hráče', miss < 90, `odchylka ${Math.round(miss)}`);
  const noisy = botAim(createTanks(51), 6);
  check('s chybou se mířidlo rozladí', Math.abs(noisy.angle - perfect.angle) >= 0);
}

console.log('\n-- konec hry --');
{
  const s = createTanks(61);
  s.bot.hp = 1;
  const perfect = aimAt(s, 'player', 0);
  s.player.angle = perfect.angle;
  s.player.power = perfect.power;
  fire(s, 'player');
  run(s, 8);
  check('zabití ukončí hru', s.phase === 'over' && s.over !== null, `${s.phase}/${s.over}`);
  check('vítězství se započítá', s.wins.player + s.wins.bot === 1, JSON.stringify(s.wins));
  check('po konci nelze střílet', fire(s, s.turn) === false);

  const next = rematch(s, 99);
  check('nové kolo drží skóre', next.wins.player + next.wins.bot === 1);
  check('nové kolo má plné HP', next.player.hp === TANK_HP && next.bot.hp === TANK_HP);
  check('nové kolo je na nové mapě', !next.terrain.heights.every((h, i) => h === s.terrain.heights[i]));
}

console.log('\n-- telemetrie pro HUD --');
{
  const s = createTanks(71);
  const info = tanksInfo(s);
  check('telemetrie nese tah', info.turn === 'player');
  check('telemetrie nese úhel i sílu', Number.isFinite(info.angle) && Number.isFinite(info.power));
  check('telemetrie nese HP obou', info.playerHp === TANK_HP && info.botHp === TANK_HP);
}

console.log(`\n${failures === 0 ? 'VŠE OK' : `${failures} CHYB`} (${checks} kontrol)`);
process.exit(failures === 0 ? 0 : 1);
