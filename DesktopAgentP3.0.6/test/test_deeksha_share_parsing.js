const assert = require('assert');

function applyShareParsing(output, minerStats) {
  const acceptedMatch = output.match(/accepted\s+(\d+)\/(\d+)\s+\(\+1\)\s+diff\s+([\d.]+[TGMK]?)(?:\s+\[([^\]]+)\])?\s+\(([\d.]+)%\)/i);
  if (acceptedMatch) {
    minerStats.accepted = parseInt(acceptedMatch[1], 10);
    minerStats.rejected = parseInt(acceptedMatch[2], 10);
    minerStats.shares = minerStats.accepted + minerStats.rejected;
    minerStats.last_share_diff = acceptedMatch[3];
    minerStats.last_share_latency = acceptedMatch[4] || null;
    minerStats.accept_rate = parseFloat(acceptedMatch[5]);
  }

  const rejectedMatch = output.match(/rejected\s+(\d+)\/(\d+)(?:\s+\(\+1\))?\s+(?:"([^"]+)"|[—–-]\s*(\S[^\n]*))/i);
  if (rejectedMatch) {
    minerStats.accepted = parseInt(rejectedMatch[1], 10);
    minerStats.rejected = parseInt(rejectedMatch[2], 10);
    minerStats.shares = minerStats.accepted + minerStats.rejected;
    minerStats.last_reject_reason = (rejectedMatch[3] || rejectedMatch[4] || '').trim();
  }

  return minerStats;
}

let stats = applyShareParsing(
  'accepted 42/1 (+1) diff 4.55K [38 ms] (97.7%)',
  { accepted: 0, rejected: 0, shares: 0 }
);
assert.equal(stats.accepted, 42);
assert.equal(stats.rejected, 1);
assert.equal(stats.shares, 43);
assert.equal(stats.last_share_diff, '4.55K');
assert.equal(stats.last_share_latency, '38 ms');
assert.equal(stats.accept_rate, 97.7);

stats = applyShareParsing(
  'rejected 42/2 — Does not meet target difficulty',
  { accepted: 0, rejected: 0, shares: 0 }
);
assert.equal(stats.accepted, 42);
assert.equal(stats.rejected, 2);
assert.equal(stats.shares, 44);
assert.equal(stats.last_reject_reason, 'Does not meet target difficulty');

stats = applyShareParsing(
  'rejected 42/3 (+1) "Duplicate share"',
  { accepted: 0, rejected: 0, shares: 0 }
);
assert.equal(stats.accepted, 42);
assert.equal(stats.rejected, 3);
assert.equal(stats.shares, 45);
assert.equal(stats.last_reject_reason, 'Duplicate share');

console.log('Deeksha share parsing OK');