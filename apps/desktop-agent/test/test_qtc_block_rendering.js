const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui', 'renderer.js'), 'utf8');

function grabLine(prefix) {
  const i = src.indexOf(prefix);
  assert(i >= 0, 'source marker missing: ' + prefix);
  const end = src.indexOf('\n', i);
  assert(end > i, 'unterminated line for: ' + prefix);
  return src.slice(i, end);
}

function grabBlock(start, end) {
  const i = src.indexOf(start);
  assert(i >= 0, 'source marker missing: ' + start);
  const j = src.indexOf(end, i);
  assert(j > i, 'source marker missing after start: ' + end);
  return src.slice(i, j);
}

const escLine = grabLine('const esc = ');
assert(escLine.includes('&quot;') && escLine.includes('&#39;'), 'esc must encode both quote types');
const shortLine = grabLine('const short = ');
const chunk = escLine + '\n' + shortLine + '\n' + grabBlock('const bl = d.blocks;', '// Wormhole rewards');

function run(d) {
  const els = {};
  const sandbox = {
    d,
    fmtTs: () => 'TS',
    $: (id) => (els[id] = els[id] || { innerHTML: '', textContent: '', style: {} }),
  };
  vm.createContext(sandbox);
  vm.runInContext(chunk, sandbox);
  return els;
}

const table = (els) => els['qtcnet-blocks-table'];
const counts = (els) => els['qtcnet-blocks-counts'];

{
  const els = run({
    blocks: {
      blocks: [
        {
          chain: 'ZION',
          height: 12345,
          hash: 'aa"><img src=x onerror=alert(1)>',
          miner: "m'><svg onload=alert(2)>",
          worker: 'w"&\'<',
          status: 'confirmed',
          ts_ms: 1,
        },
      ],
      counts: { zion: 1, qtc: 0 },
      sources: { pool: 1 },
    },
  });
  const html = table(els).innerHTML;
  assert(!html.includes('<img'), 'img injection in ZION row');
  assert(!html.includes('<svg'), 'svg injection in ZION row');
  assert(html.includes('title="aa&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"'), 'hash stays fully inside title attr');
  assert(html.includes('title="m&#39;&gt;&lt;svg onload=alert(2)&gt;"'), 'miner stays fully inside title attr');
  assert(html.includes('&#39;'), 'single quote must be encoded');
  assert(html.includes('&quot;'), 'double quote must be encoded');
  assert(html.includes('<td>12345</td>'), 'plain height still renders');
  assert(html.includes('w&quot;&amp;&#39;&lt;'), 'worker fully escaped');
  assert.strictEqual(counts(els).textContent, 'ZION 1 · QTC 0 · pool:1');
}

{
  const els = run({
    blocks: {
      blocks: [
        {
          chain: 'QTC',
          amount: '1"><img src=x>',
          height: '<svg onload=alert(1)>',
          leaf: 'x"><script>alert(1)</script>',
          status: 'reward',
          ts_ms: 2,
        },
      ],
      counts: { zion: 0, qtc: 1 },
    },
  });
  const html = table(els).innerHTML;
  assert(!html.includes('<img'), 'img injection in QTC amount');
  assert(!html.includes('<svg'), 'svg injection in QTC height');
  assert(!html.includes('<script>'), 'script injection in leaf');
  assert(html.includes('&lt;img'), 'amount must be escaped');
  assert(html.includes('&lt;svg'), 'height must be escaped');
  assert(html.includes('native node'), 'QTC row must show native node source');
  assert.strictEqual(counts(els).textContent, 'ZION 0 · QTC 1');
}

{
  const els = run({
    blocks: {
      blocks: [
        { chain: 'ZION', height: 777, hash: 'deadbeefcafe1234', miner: 'minerXYZ123', worker: 'rig1', status: 'orphaned', ts_ms: 3 },
        { chain: 'QTC', amount: 5.5, height: 888, leaf: 42, status: 'confirmed', ts_ms: 4 },
      ],
      counts: { zion: 1, qtc: 1 },
      sources: { pool: 1, node: 1 },
    },
  });
  const html = table(els).innerHTML;
  assert(html.includes('<td>777</td>'), 'plain height renders unchanged');
  assert(html.includes('<td>888</td>'), 'plain QTC height renders unchanged');
  assert(html.includes('+5.5 QTC'), 'plain amount renders unchanged');
  assert(html.includes('deadbeefcafe…'), 'hash shortened as before');
  assert(html.includes('minerXYZ12…'), 'miner shortened as before');
  assert(html.includes('·rig1'), 'worker suffix renders');
  assert(html.includes('ZION') && html.includes('QTC'), 'chain labels render');
  assert.strictEqual(counts(els).textContent, 'ZION 1 · QTC 1 · pool:1 node:1');
}

{
  const els = run({});
  assert(table(els).innerHTML.includes('Block feed unavailable.'), 'unavailable fallback');
  assert.strictEqual(counts(els).textContent, '');
}

{
  const els = run({ blocks: { blocks: [], counts: {} } });
  assert(table(els).innerHTML.includes('No found blocks yet'), 'empty rows fallback');
  assert.strictEqual(counts(els).textContent, 'ZION 0 · QTC 0');
}

{
  const els = run({
    blocks: {
      blocks: [{ chain: 'ZION', status: 'pending' }],
      counts: {},
      sources: {},
    },
  });
  const html = table(els).innerHTML;
  assert(html.includes('<td>—</td>'), 'missing height renders dash');
  assert(html.includes('title=""'), 'missing miner produces empty title');
  assert.strictEqual(counts(els).textContent, 'ZION 0 · QTC 0');
}

console.log('test_qtc_block_rendering.js: all cases passed');
