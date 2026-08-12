/* Simple Explorer API audit */
const https = require('https');

const BASE = 'app.zionterranova.com';

function get(path) {
  return new Promise((resolve) => {
    const req = https.get({ hostname: BASE, path, timeout: 30000 }, (res) => {
      let body = '';
      res.on('data', (d) => body += d);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body: body.slice(0, 200) });
        }
      });
    });
    req.on('error', (err) => resolve({ status: 0, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
  });
}

const tests = [
  { path: '/api/blockchain/stats', check: (j) => j.block_height > 0 },
  { path: '/api/blockchain/blocks?limit=5', check: (j) => Array.isArray(j) && j.length === 5 && j[0].reward > 0 },
  { path: '/api/blockchain/block?height=2745', check: (j) => j.height === 2745 && j.reward > 0 },
  { path: '/api/blockchain/transactions?hash=72866dc899f68a6ec77a562dc481df36c20f957a3f4e4fd75a4b12ec42aed8bb', check: (j) => j.tx_hash && j.from },
  { path: '/api/blockchain/address?address=zion1n4k4n5e4p0z3g7z2e0z0j7c8w7y0v5m8c6hf8c2', check: (j) => j.address && j.balance && j.transactions.length > 0 },
  { path: '/api/blockchain/mempool', check: (j) => typeof j.count === 'number' },
  { path: '/api/blockchain/miners?limit=5', check: (j) => j.miners && j.miners.length > 0 },
  { path: '/api/blockchain/emission', check: (j) => j.circulating_supply > 0 },
  { path: '/api/blockchain/consensus?chart=false', check: (j) => j.consensus && j.network.chain_height > 0 },
];

(async () => {
  let passed = 0;
  for (const t of tests) {
    const res = await get(t.path);
    const ok = res.status === 200 && res.json && t.check(res.json);
    if (ok) {
      console.log(`OK ${t.path}`);
      passed++;
    } else {
      console.log(`FAIL ${t.path} status=${res.status} error=${res.error || 'check failed'} body=${JSON.stringify(res.json || res.body).slice(0, 120)}`);
    }
  }
  console.log(`\n${passed}/${tests.length} API checks passed`);
  process.exit(passed === tests.length ? 0 : 1);
})();
