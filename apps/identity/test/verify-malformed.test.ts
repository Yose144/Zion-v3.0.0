// Regrese: poškozený veřejný klíč nebo podpis musí být **selhání přihlášení**,
// ne 500. Kontraktní test (`Kingdom/scripts/check-zis-contract.mjs`) to našel
// na živém ZIS: `POST /api/auth/verify/ed25519` s `publicKey: "00"` vracel 500
// místo 401, protože `publicKeyToAddress()` hází na délce != 32.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyEd25519 } from '../src/lib/challenge.js';

const CHALLENGE = 'ZION-AUTH-V1\naddress: zion1test\nnonce: 00\nissued: 2026-11-01T00:00:00.000Z\nttl: 300000ms';

function prismaStub() {
  return {
    authChallenge: {
      findUnique: async () => ({ challenge: CHALLENGE, expiresAt: new Date(Date.now() + 60_000) }),
      delete: async () => ({}),
    },
  } as never;
}

test('poškozený veřejný klíč je false, ne výjimka', async () => {
  const cases: Array<[string, string]> = [
    ['00', '00'],
    ['', ''],
    ['zz', 'zz'],
    ['00'.repeat(32), '00'], // správná délka klíče, krátký podpis
    ['00', '00'.repeat(64)], // krátký klíč, správná délka podpisu
  ];

  for (const [publicKey, signature] of cases) {
    const result = await verifyEd25519(prismaStub(), 'zion1test', signature, publicKey);
    assert.equal(result, false, `publicKey=${publicKey.slice(0, 8)}… signature=${signature.slice(0, 8)}…`);
  }
});

test('bez vydané výzvy je false', async () => {
  const prisma = { authChallenge: { findUnique: async () => null } } as never;
  assert.equal(await verifyEd25519(prisma, 'zion1test', '00'.repeat(64), '00'.repeat(32)), false);
});
