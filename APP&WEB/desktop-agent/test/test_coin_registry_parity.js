// Parity test: the desktop-agent coin registry (renderer.js) must stay in
// sync with the pool-side canonical ExternalCoin enum + algorithm() names
// (V31/L1/cosmic-harmony/src/profit.rs). If a coin is added on one side and
// forgotten on the other, this test fails.
//
// Run: node test/test_coin_registry_parity.js

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const RENDERER = path.join(__dirname, '..', 'src', 'ui', 'renderer.js');
const PROFIT_RS = path.join(
  __dirname, '..', '..', '..', 'V31', 'L1', 'cosmic-harmony', 'src', 'profit.rs'
);

function evalStringArray(src, name) {
  const re = new RegExp(`const ${name} = \\[([^\\]]*)\\]`, 's');
  const m = src.match(re);
  assert(m, `${name} not found in renderer.js`);
  return [...m[1].matchAll(/'([A-Z]+)'/g)].map(x => x[1]);
}

function evalAlgoMap(src, name) {
  const re = new RegExp(`const ${name} = \\{([^}]*\\}[^;]*)\\}`, 's');
  // simpler: capture between `const NAME = {` and the closing `};`
  const start = src.indexOf(`const ${name} = {`);
  assert(start >= 0, `${name} not found`);
  const end = src.indexOf('};', start);
  const body = src.slice(start, end);
  const map = {};
  for (const mm of body.matchAll(/([A-Z]+):\s*'([^']+)'/g)) {
    map[mm[1]] = mm[2];
  }
  return map;
}

const rendererSrc = fs.readFileSync(RENDERER, 'utf8');
const profitSrc = fs.readFileSync(PROFIT_RS, 'utf8');

const gpuCoins = evalStringArray(rendererSrc, 'EXT_GPU_COINS');
const cpuCoins = evalStringArray(rendererSrc, 'EXT_CPU_COINS');
const algoMap = evalAlgoMap(rendererSrc, 'EXT_COIN_ALGO');

// --- Parse pool side ---
// ticker(): ExternalCoin::X => "TICKER"   (in as_str())
// algorithm(): ExternalCoin::X => "algo"  (in algorithm())
// They appear as two sequential match arms; distinguish by value shape.
const tickerMap = {};
const algoMapRs = {};
let section = '';
for (const line of profitSrc.split('\n')) {
  if (/fn as_str|fn ticker/.test(line)) section = 'ticker';
  else if (/fn algorithm/.test(line)) section = 'algo';
  else if (/fn is_cpu|fn is_gpu|fn dag_size/.test(line)) section = '';
  const m = line.match(/ExternalCoin::(\w+)\s*=>\s*"([A-Za-z0-9_-]+)"/);
  if (m && section === 'ticker') tickerMap[m[1]] = m[2];
  else if (m && section === 'algo') algoMapRs[m[1]] = m[2];
}

const poolTickers = Object.values(tickerMap);
assert(poolTickers.length > 10, `pool parse failed — only ${poolTickers.length} tickers`);

// Pool tickers that are deliberately not user-selectable in the desktop UI:
// BTC  — sha256d, ASIC-only territory, no GPU/CPU kernel path.
// PRL  — Pearl, profile explicitly disabled in CoinProfile::defaults().
const UI_EXCLUDED = new Set(['BTC', 'PRL']);

// --- Assertions ---
// 1. Every renderer-listed coin exists in the pool enum.
for (const t of [...gpuCoins, ...cpuCoins]) {
  assert(
    poolTickers.includes(t),
    `renderer coin ${t} missing from ExternalCoin enum`
  );
}

// 2. GPU and CPU lists are disjoint.
const overlap = gpuCoins.filter(t => cpuCoins.includes(t));
assert.deepStrictEqual(overlap, [], `coins in both lists: ${overlap}`);

// 3. Every algo-map entry belongs to a listed coin (no orphans).
for (const t of Object.keys(algoMap)) {
  assert(
    gpuCoins.includes(t) || cpuCoins.includes(t),
    `EXT_COIN_ALGO has orphan key ${t}`
  );
}

// 4. Every listed coin has an algo label.
for (const t of [...gpuCoins, ...cpuCoins]) {
  assert(algoMap[t], `coin ${t} missing EXT_COIN_ALGO entry`);
}

// 5. Algorithm labels match the pool's canonical algorithm() names.
for (const [variant, ticker] of Object.entries(tickerMap)) {
  if (algoMap[ticker]) {
    assert.strictEqual(
      algoMap[ticker],
      algoMapRs[variant],
      `algo mismatch for ${ticker}: renderer='${algoMap[ticker]}' pool='${algoMapRs[variant]}'`
    );
  }
}

// 6. All pool coins are covered by the UI lists unless UI_EXCLUDED.
for (const ticker of poolTickers) {
  if (UI_EXCLUDED.has(ticker)) continue;
  const covered = gpuCoins.includes(ticker) || cpuCoins.includes(ticker);
  assert(covered, `pool coin ${ticker} not selectable in desktop UI (add to registry or UI_EXCLUDED)`);
}

// 7. CPU device coins match the pool's is_cpu() set.
const cpuMatch = profitSrc.match(/ExternalCoin::(\w+)\s*\|\s*ExternalCoin::(\w+)\s*\|\s*ExternalCoin::(\w+)/);
const poolCpuTickers = new Set();
{
  // is_cpu() matches Monero | Verus | Raptoreum — grab the matches! block.
  const cpuBlock = profitSrc.match(/fn is_cpu[\s\S]*?matches!\(\s*self,([\s\S]*?)\)/);
  assert(cpuBlock, 'is_cpu() block not found');
  for (const mm of cpuBlock[1].matchAll(/ExternalCoin::(\w+)/g)) {
    const t = tickerMap[mm[1]];
    if (t) poolCpuTickers.add(t);
  }
}
for (const t of cpuCoins) {
  assert(poolCpuTickers.has(t), `UI CPU coin ${t} is not is_cpu() on the pool`);
}
for (const t of poolCpuTickers) {
  assert(cpuCoins.includes(t), `pool CPU coin ${t} missing from EXT_CPU_COINS`);
}

console.log(`PASS — ${gpuCoins.length} GPU + ${cpuCoins.length} CPU coins in parity with pool (${poolTickers.length} enum tickers, excluded: ${[...UI_EXCLUDED].join(',')})`);
