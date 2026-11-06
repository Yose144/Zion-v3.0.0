#!/usr/bin/env node
/**
 * Test bezpečnostního prohlášení u svíčkového zboží.
 *
 * Ověřuje **čistou funkci** `checkFireConsent` z `src/lib/fire-safety.ts` —
 * tedy stejnou logiku, kterou volá `/api/shop/orders`. Explicitně se testuje,
 * že vypnutý JavaScript nepomůže: bez `accepted`/podpisu objednávka neprojde,
 * i kdyby ji někdo poslal curl-em přímo na API.
 *
 * Proč ne prohlížeč: tohle je rozhodnutí serveru nad daty, ne UI. Prohlížečová
 * část (blok v pokladně, zašedlé tlačítko) má vlastní test
 * `.artifacts/probe/lumi-checkout-consent.mjs`.
 *
 * Použití (z `apps/MarketPlace/`):
 *   node e2e/fire-consent.mjs
 */

import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const { build } = require('esbuild');

const dir = await mkdtemp(join(tmpdir(), 'zion-fire-'));
const outfile = join(dir, 'fire-safety.mjs');
await build({
  entryPoints: [resolve(here, '../src/lib/fire-safety.ts')],
  outfile,
  bundle: true,
  format: 'esm',
  platform: 'node',
  logLevel: 'warning',
});
const { checkFireConsent, requiresFireConsent, FIRE_CONSENT_VERSION, FIRE_SAFETY } = await import(
  pathToFileURL(outfile).href
);

const checks = [];
const check = (name, condition) => {
  checks.push({ name, ok: Boolean(condition) });
  if (!condition) console.error(`FAIL ${name}`);
};

const lamp = [{ externalId: 'lamp-001' }];
const book = [{ externalId: 'book-001' }];

// 1) Košík bez svíčkového zboží prohlášení neřeší
check('kniha nevyžaduje prohlášení', requiresFireConsent(book) === false);
check('kniha projde bez podpisu', checkFireConsent(book, undefined) === null);

// 2) Svíčkové zboží bez podpisu neprojde
check('lampion vyžaduje prohlášení', requiresFireConsent(lamp) === true);
const missing = checkFireConsent(lamp, undefined);
check('bez podpisu = chyba', missing && missing.ok === false && missing.code === 'fire_consent_required');
const unchecked = checkFireConsent(lamp, { accepted: false, signature: 'Jan Novák' });
check('nepotvrzené = chyba', unchecked && unchecked.ok === false);
const short = checkFireConsent(lamp, { accepted: true, signature: '  a  ' });
check('příliš krátký podpis = chyba', short && short.ok === false);
const tooLong = checkFireConsent(lamp, { accepted: true, signature: 'x'.repeat(121) });
check('příliš dlouhý podpis = chyba', tooLong && tooLong.ok === false);

// 3) Platný podpis projde a vrátí jméno i verzi
const good = checkFireConsent(lamp, {
  accepted: true,
  signature: '  Jan Novák  ',
  version: FIRE_CONSENT_VERSION,
});
check('platný podpis projde', good && good.ok === true);
check('jméno je oříznuté', good && good.ok === true && good.name === 'Jan Novák');
check('verze se vrací', good && good.ok === true && good.version === FIRE_CONSENT_VERSION);

// 4) Starší verze textu se nevrací jako chyba — je to důkaz, co zákazník viděl
const stale = checkFireConsent(lamp, { accepted: true, signature: 'Jan Novák', version: 'fire-2025-01-01' });
check('starší verze projde', stale && stale.ok === true);
check('starší verze se uloží', stale && stale.ok === true && stale.version === 'fire-2025-01-01');

// 5) Text prohlášení obsahuje to, na čem stojí smysl testu
const all = JSON.stringify(FIRE_SAFETY);
check('text zmiňuje sklenici', /sklenic|glass/.test(all));
check('text zmiňuje odpovědnost', /neodpovídá|not liable/.test(all));
check('text zmiňuje děti', /dět|child/i.test(all));

await rm(dir, { recursive: true, force: true });

const failed = checks.filter((c) => !c.ok);
console.log(JSON.stringify({ total: checks.length, failed: failed.length, checks }, null, 1));
process.exit(failed.length === 0 ? 0 : 1);
