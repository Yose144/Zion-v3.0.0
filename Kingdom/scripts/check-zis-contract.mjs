#!/usr/bin/env node
/**
 * Kontraktní test ZIS.
 *
 * Volá živý ZION Identity Service a ověřuje **tvar odpovědí**, na kterých stojí
 * celý ekosystém. Cílem není testovat ZIS dovnitř, ale zachytit změnu, která by
 * tiše rozbila konzumenty (website, market, pool-ui, nirvana, Kingdom).
 *
 *   node scripts/check-zis-contract.mjs              # proti produkci
 *   ZIS_URL=http://127.0.0.1:8096 node …             # proti loopbacku
 *
 * Není součástí `npm run verify` — potřebuje síť. Spouštěj před deployem ZIS.
 */

const BASE = (process.env.ZIS_URL ?? 'https://auth.zionterranova.com').replace(/\/+$/, '');

/* Adresa z veřejně známé testovací fráze — challenge ji přijme, uživatele nevytvoří. */
const TEST_ADDRESS = 'zion1m6v887k5z56335t8r6m655f0k468h4m6k3n63p2';

let failures = 0;

function ok(name, detail = '') {
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail) {
  failures += 1;
  console.error(`  ✗ ${name} — ${detail}`);
}

async function call(path, init) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { accept: 'application/json', ...(init?.body ? { 'content-type': 'application/json' } : {}), ...init?.headers },
    redirect: 'manual',
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body, contentType: response.headers.get('content-type') ?? '' };
}

function expect(condition, name, detail) {
  if (condition) ok(name);
  else fail(name, detail);
}

console.log(`ZIS kontrakt → ${BASE}\n`);

/* 1. Služba žije */
try {
  const health = await call('/health');
  expect(health.status === 200, 'GET /health → 200', `dostal ${health.status}`);
} catch (error) {
  fail('GET /health', `nedostupné: ${error.message}`);
}

/* 2. JWKS — EdDSA veřejné klíče pro lokální verifikaci JWT */
try {
  const jwks = await call('/.well-known/jwks.json');
  const key = jwks.body?.keys?.[0];
  expect(jwks.status === 200, 'GET /.well-known/jwks.json → 200', `dostal ${jwks.status}`);
  expect(key?.kty === 'OKP', 'JWKS klíč je OKP', `kty=${key?.kty}`);
  expect(key?.crv === 'Ed25519', 'JWKS křivka je Ed25519', `crv=${key?.crv}`);
  expect(typeof key?.kid === 'string' && key.kid.length > 0, 'JWKS klíč má kid', `kid=${key?.kid}`);
} catch (error) {
  fail('GET /.well-known/jwks.json', error.message);
}

/* 3. Challenge — formát, na kterém stojí podpis v prohlížeči */
try {
  const challenge = await call('/api/auth/challenge', {
    method: 'POST',
    body: JSON.stringify({ address: TEST_ADDRESS, chainType: 'zion-l1' }),
  });
  const text = challenge.body?.challenge;
  expect(challenge.status === 200, 'POST /api/auth/challenge → 200', `dostal ${challenge.status}`);
  expect(typeof text === 'string' && text.startsWith('ZION-AUTH-V1'), 'challenge začíná "ZION-AUTH-V1"', `začátek: ${String(text).slice(0, 24)}`);
  expect(String(text).includes(`address: ${TEST_ADDRESS}`), 'challenge nese adresu', 'adresa v textu chybí');
  expect(typeof challenge.body?.expiresInMs === 'number', 'challenge má expiresInMs', `typ: ${typeof challenge.body?.expiresInMs}`);
  expect(challenge.body?.chainType === 'zion-l1', 'challenge vrací chainType', `chainType=${challenge.body?.chainType}`);
} catch (error) {
  fail('POST /api/auth/challenge', error.message);
}

/* 4. Nepřihlášený = 401, ne 200 s prázdným objektem */
try {
  const me = await call('/api/auth/me');
  expect(me.status === 401, 'GET /api/auth/me bez cookie → 401', `dostal ${me.status}`);
} catch (error) {
  fail('GET /api/auth/me', error.message);
}

/* 5. Špatný podpis = 401 (nikdy 500) */
try {
  const verify = await call('/api/auth/verify/ed25519', {
    method: 'POST',
    body: JSON.stringify({ address: TEST_ADDRESS, publicKey: '00', signature: '00' }),
  });
  expect(verify.status === 401, 'POST /verify/ed25519 se špatným podpisem → 401', `dostal ${verify.status}`);
} catch (error) {
  fail('POST /api/auth/verify/ed25519', error.message);
}

/* 6. Generovaný avatar — používá ho web i market */
try {
  const avatar = await call(`/api/auth/avatar/${TEST_ADDRESS}.svg`);
  expect(avatar.status === 200, 'GET /api/auth/avatar/:seed.svg → 200', `dostal ${avatar.status}`);
  expect(avatar.contentType.includes('svg'), 'avatar je SVG', `content-type=${avatar.contentType}`);
} catch (error) {
  fail('GET /api/auth/avatar', error.message);
}

console.log('');
if (failures === 0) {
  console.log('ZIS kontrakt: OK');
  process.exit(0);
}
console.error(`ZIS kontrakt: ${failures} porušení`);
process.exit(1);
