const $ = (id) => document.getElementById(id);
const api = () => $('apiBase').value.replace(/\/$/, '');

function snakeChain(name) {
  const n = name.toLowerCase().trim().replace(/-/g, '_');
  // quick aliases
  const aliases = { 'zionl1': 'zion_l1', 'zion-l1': 'zion_l1', 'eth': 'ethereum', 'btc': 'bitcoin', 'bnb': 'bsc' };
  return aliases[n] ?? n;
}

async function req(path, opts = {}) {
  const url = api() + path;
  const out = opts.out ? $(opts.out) : null;
  if (out) out.textContent = 'loading...';
  try {
    const res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    const pretty = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
    if (out) {
      out.className = res.ok ? 'ok' : 'err';
      out.textContent = `HTTP ${res.status}\n${pretty}`;
    }
    return { ok: res.ok, data };
  } catch (e) {
    if (out) { out.className = 'err'; out.textContent = String(e); }
    return { ok: false, data: null };
  }
}

async function refreshStatus() {
  const health = await req('/v1/multichain/health', { out: 'statusOut' });
  if (health.ok) {
    const chains = await req('/v1/multichain/chains');
    $('statusOut').textContent = JSON.stringify({ health: health.data, chains: chains.data }, null, 2);
  }
}

async function loadContracts() {
  const r = await req('/v1/multichain/contracts');
  if (!r.ok) return;
  const all = r.data;
  const tbody = $('contractsOut');
  tbody.innerHTML = '';
  for (const [chain, c] of Object.entries(all)) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${chain}</td><td>${shortAddr(c.wzion)}</td><td>${shortAddr(c.bridge)}</td>`;
    tbody.appendChild(tr);
  }
  $('contractsRaw').textContent = JSON.stringify(all, null, 2);
}

function shortAddr(a) {
  if (!a || a.length < 12) return a;
  return a.slice(0, 6) + '...' + a.slice(-4);
}

function parseAsset(s) {
  const parts = s.split(':');
  if (parts.length < 2) throw new Error('Asset format: chain:TICKER[:contract]');
  const chain = snakeChain(parts[0]);
  const ticker = parts[1].toUpperCase();
  const contract = parts[2] || null;
  return { id: { chain, ticker, contract }, decimals: 6, name: ticker };
}

$('refreshStatus').onclick = refreshStatus;

$('deriveAddress').onclick = async () => {
  const body = {
    chain: $('walletChain').value,
    account: Number($('walletAccount').value),
    index: Number($('walletIndex').value),
  };
  await req('/v1/wallet/address', { method: 'POST', body, out: 'walletOut' });
};

$('signMessageBtn').onclick = async () => {
  const body = {
    chain: $('walletChain').value,
    message: $('signMessage').value,
    account: Number($('walletAccount').value),
    index: Number($('walletIndex').value),
  };
  await req('/v1/wallet/sign', { method: 'POST', body, out: 'signOut' });
};

$('bridgeSubmit').onclick = async () => {
  const body = {
    direction: $('bridgeDir').value,
    from: $('bridgeFrom').value,
    to: $('bridgeTo').value,
    amount: Number($('bridgeAmount').value),
    source_address: $('bridgeSource').value || undefined,
    target_address: $('bridgeTarget').value || undefined,
  };
  await req('/v1/bridge/submit', { method: 'POST', body, out: 'bridgeOut' });
};

$('swapQuote').onclick = async () => {
  const body = {
    from: parseAsset($('swapFrom').value),
    to: parseAsset($('swapTo').value),
    amount: Number($('swapAmount').value),
  };
  await req('/v1/swap/quote', { method: 'POST', body, out: 'swapOut' });
};

$('swapExecute').onclick = async () => {
  const body = {
    from: parseAsset($('swapFrom').value),
    to: parseAsset($('swapTo').value),
    amount: Number($('swapAmount').value),
  };
  await req('/v1/swap/execute', { method: 'POST', body, out: 'swapOut' });
};

// Boot
refreshStatus();
loadContracts();
