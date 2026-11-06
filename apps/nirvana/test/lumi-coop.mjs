#!/usr/bin/env node
/**
 * Test kooperativní odměny (L-11) — bez prohlížeče.
 *
 * Odměna je „PPLNS bez hashů": pool se dělí podle toho, kdo kolik světel
 * přinesl, s podlahou pro každého, kdo doletěl. Test hlídá přesně to, co
 * by se jinak rozešlo potichu:
 *  1. sólo neplatí nic (není co rozdělovat),
 *  2. podíl roste s přínosem a součet zůstává v poolu,
 *  3. kdo nic nese, nedostane nulu (podlaha),
 *  4. rozbitá čísla (NaN, zápory) výpočet nerozhodí.
 *
 * Spuštění: cd apps/nirvana && npx tsx test/lumi-coop.mjs
 */

const { COOP_FLOOR, COOP_POOL, coopSplit } = await import('../src/core/lumi/coop.ts');

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

console.log('\n== Lumi: kooperativní odměna (PPLNS podíl) ==');

const solo = coopSplit({ mine: 7, others: [] });
check('sólo nic nedostane', solo.bonus === 0, String(solo.bonus));
check('sólo hlásí jednoho hráče', solo.players === 1);

const even = coopSplit({ mine: 3, others: [3] });
check('rovný přínos = rovný podíl', Math.abs(even.share - 0.5) < 1e-6, String(even.share));
check('dva hráči si pool rozdělí', Math.abs(even.bonus - COOP_POOL / 2) <= 20, String(even.bonus));

const lead = coopSplit({ mine: 5, others: [2] });
const trail = coopSplit({ mine: 2, others: [5] });
check('kdo nese víc, dostane víc', lead.bonus > trail.bonus, `${lead.bonus} vs ${trail.bonus}`);
check('podíly jsou zrcadlové', Math.abs(lead.share + trail.share - 1) < 1e-6, `${lead.share} + ${trail.share}`);
check('nikdo nedostane nulu', trail.bonus > 0, String(trail.bonus));

const carrier = coopSplit({ mine: 0, others: [7] });
check('nosič bez světla dostane podlahu', carrier.bonus >= Math.round(COOP_POOL * COOP_FLOOR) - 5, String(carrier.bonus));
check('nosič dostane méně než sběrač', carrier.bonus < coopSplit({ mine: 7, others: [0] }).bonus);

const none = coopSplit({ mine: 0, others: [0, 0] });
check('bez sebraných světel se dělí rovně', Math.abs(none.share - 1 / 3) < 1e-6, String(none.share));
check('rovné dělení dá každému třetinu', Math.abs(none.bonus - COOP_POOL / 3) <= 25, String(none.bonus));

// První doletí dřív, než ostatní sbírali → rovný díl, ne celý pool.
const early = coopSplit({ mine: 7, others: [0, 0] });
check('sám se vším, ostatní zatím nic = rovný díl', Math.abs(early.share - 1 / 3) < 1e-6, String(early.share));
check('první doletěvší nedostane celý pool', early.bonus < COOP_POOL * 0.5, String(early.bonus));

const four = coopSplit({ mine: 4, others: [1, 1, 1] });
check('čtyři hráči se vejdou do poolu', four.bonus <= COOP_POOL && four.bonus > 0, String(four.bonus));

const broken = coopSplit({ mine: Number.NaN, others: [Number.NaN, -3] });
check('NaN a zápory nespadnou', Number.isFinite(broken.bonus) && broken.bonus >= 0, String(broken.bonus));

const huge = coopSplit({ mine: 1e9, others: [1] });
check('extrémní přínos nepřeleze pool', huge.bonus <= COOP_POOL, String(huge.bonus));
check('bonus je celé číslo', Number.isInteger(huge.bonus));

console.log('');
if (failures > 0) {
  console.log(`LUMI COOP FAILED (${failures})`);
  process.exit(1);
}
console.log('LUMI COOP OK');
