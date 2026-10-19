import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sortGifts, checkoutUrl, loadStatus } from '../js/gifts.js';

const gifts = JSON.parse(fs.readFileSync(new URL('../data/gifts.json', import.meta.url)));
const ids = list => list.map(g => g.id);

test('sortGifts asc puts cheapest first', () => {
  assert.deepEqual(ids(sortGifts(gifts, 'asc')).slice(0, 2), ['rio-carnival-beach', 'vietnam-homestay']);
  assert.equal(sortGifts(gifts, 'asc').at(-1).id, 'serengeti-four-seasons');
});

test('sortGifts desc puts most expensive first', () => {
  assert.equal(sortGifts(gifts, 'desc')[0].id, 'serengeti-four-seasons');
  assert.equal(sortGifts(gifts, 'desc').at(-1).id, 'rio-carnival-beach');
});

test('sortGifts keeps list order for equal prices in both directions', () => {
  for (const order of ['asc', 'desc']) {
    const sorted = ids(sortGifts(gifts, order));
    assert.ok(sorted.indexOf('kazakhstan-horseback') < sorted.indexOf('indonesia-treehouse'), order);
    assert.ok(sorted.indexOf('tahiti-dolphins') < sorted.indexOf('guinea-radisson'), order);
  }
});

test('sortGifts does not mutate its input', () => {
  const before = ids(gifts);
  sortGifts(gifts, 'desc');
  assert.deepEqual(ids(gifts), before);
});

test('checkoutUrl adds locale=fr only in French', () => {
  assert.equal(checkoutUrl({ paymentLink: 'https://buy.stripe.com/x' }, 'fr'), 'https://buy.stripe.com/x?locale=fr');
  assert.equal(checkoutUrl({ paymentLink: 'https://buy.stripe.com/x' }, 'en'), 'https://buy.stripe.com/x');
});

test('checkoutUrl is null without a payment link', () => {
  assert.equal(checkoutUrl({ paymentLink: null }, 'en'), null);
});

test('loadStatus returns the gifted map', async () => {
  const fetchOk = async () => ({ ok: true, json: async () => ({ gifted: { a: { name: 'X', note: null } } }) });
  assert.deepEqual(await loadStatus('u', fetchOk), { a: { name: 'X', note: null } });
});

test('loadStatus returns {} when the request fails, is non-OK, or is malformed', async () => {
  assert.deepEqual(await loadStatus('u', async () => { throw new Error('down'); }), {});
  assert.deepEqual(await loadStatus('u', async () => ({ ok: false })), {});
  assert.deepEqual(await loadStatus('u', async () => ({ ok: true, json: async () => ({ nope: 1 }) })), {});
  assert.deepEqual(await loadStatus('u', async () => ({ ok: true, json: async () => { throw new SyntaxError('bad'); } })), {});
});

test('loadStatus returns {} after the timeout', async () => {
  assert.deepEqual(await loadStatus('u', () => new Promise(() => {}), 20), {});
});

test('loadStatus does not fetch when the URL is empty', async () => {
  let called = false;
  assert.deepEqual(await loadStatus('', async () => { called = true; }), {});
  assert.equal(called, false);
});

import { loadGifts } from '../js/gifts.js';

test('loadGifts returns the gift list', async () => {
  assert.deepEqual(await loadGifts('u', async () => ({ ok: true, json: async () => [{ id: 'a' }] })), [{ id: 'a' }]);
});

test('loadGifts returns null on failure, non-OK or a non-array body', async () => {
  assert.equal(await loadGifts('u', async () => { throw new Error('down'); }), null);
  assert.equal(await loadGifts('u', async () => ({ ok: false })), null);
  assert.equal(await loadGifts('u', async () => ({ ok: true, json: async () => ({}) })), null);
});
