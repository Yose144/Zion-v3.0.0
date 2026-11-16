import assert from 'node:assert/strict';
import { wzionPriceSource } from './defi-price-source.ts';

assert.equal(wzionPriceSource(false, true), 'live-pancake');
assert.equal(wzionPriceSource(true, true), 'live-usdt');
assert.equal(wzionPriceSource(false, false), 'seed-fallback');
assert.notEqual(wzionPriceSource(false, false), 'live');

console.log('defi-price-source ok');
