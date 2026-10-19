import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildPaymentLinkParams, buildCustomFieldParams, buildProductParams, selectGifts } from '../scripts/create-payment-links.mjs';

const gifts = JSON.parse(fs.readFileSync(new URL('../data/gifts.json', import.meta.url)));
const iceland = gifts.find(g => g.id === 'iceland-car-rental');
const p = buildPaymentLinkParams(iceland, 'price_123', 'https://sadio.me/marrying_rehana');

test('one fixed-price item, one purchase allowed', () => {
  assert.equal(p.get('line_items[0][price]'), 'price_123');
  assert.equal(p.get('line_items[0][quantity]'), '1');
  assert.equal(p.get('restrictions[completed_sessions][limit]'), '1');
  assert.equal(p.get('inactive_message'), 'This gift has already been given. Thank you! 🤍 / Ce cadeau a déjà été offert. Merci ! 🤍');
});

test('redirects back to the registry with the gift id', () => {
  assert.equal(p.get('after_completion[type]'), 'redirect');
  assert.equal(p.get('after_completion[redirect][url]'), 'https://sadio.me/marrying_rehana/?gifted=iceland-car-rental');
});

test('required name text field', () => {
  assert.equal(p.get('custom_fields[0][key]'), 'guestname');
  assert.equal(p.get('custom_fields[0][type]'), 'text');
  assert.equal(p.get('custom_fields[0][label][type]'), 'custom');
  assert.equal(p.get('custom_fields[0][label][custom]'), 'Your name / Votre nom');
  assert.equal(p.get('custom_fields[0][optional]'), 'false');
  assert.equal(p.get('custom_fields[0][text][maximum_length]'), '60');
});

test('required note text field', () => {
  assert.equal(p.get('custom_fields[1][key]'), 'guestnote');
  assert.equal(p.get('custom_fields[1][type]'), 'text');
  assert.equal(p.get('custom_fields[1][label][custom]'), 'Please leave us a note / Laissez-nous un mot');
  assert.equal(p.get('custom_fields[1][optional]'), 'false');
  assert.equal(p.get('custom_fields[1][text][maximum_length]'), '255');
});

test('required display-choice dropdown', () => {
  assert.equal(p.get('custom_fields[2][key]'), 'display');
  assert.equal(p.get('custom_fields[2][type]'), 'dropdown');
  assert.equal(p.get('custom_fields[2][optional]'), 'false');
  assert.equal(p.get('custom_fields[2][label][custom]'), 'Show on the registry? / Afficher ?');
  assert.deepEqual([0, 1, 2].map(i => p.get(`custom_fields[2][dropdown][options][${i}][value]`)), ['namenote', 'nameonly', 'private']);
  assert.deepEqual([0, 1, 2].map(i => p.get(`custom_fields[2][dropdown][options][${i}][label]`)),
    ['Name & note / Nom et mot', 'Name only / Nom seulement', 'Keep private / Rester privé']);
});

test('custom field labels fit Stripe\'s 50-character limit', () => {
  for (const [k, v] of p) if (/custom_fields\[\d\]\[label\]\[custom\]/.test(k)) assert.ok(v.length <= 50, v);
});

const a = { id: 'a', paymentLinkId: null };
const b = { id: 'b', paymentLinkId: 'plink_b' };

test('selectGifts defaults to gifts without a link', () => {
  assert.deepEqual(selectGifts([a, b], { reset: false, only: null }).map(g => g.id), ['a']);
});

test('selectGifts --reset selects everything', () => {
  assert.deepEqual(selectGifts([a, b], { reset: true, only: null }).map(g => g.id), ['a', 'b']);
});

test('selectGifts --only selects one gift even if it has a link', () => {
  assert.deepEqual(selectGifts([a, b], { reset: false, only: 'b' }).map(g => g.id), ['b']);
});

test('selectGifts --only rejects unknown ids', () => {
  assert.throws(() => selectGifts([a, b], { reset: false, only: 'nope' }), /Unknown gift id: nope/);
});

test('buildCustomFieldParams holds only the three custom fields, for updating existing links', () => {
  const f = buildCustomFieldParams();
  assert.equal(f.get('custom_fields[0][key]'), 'guestname');
  assert.equal(f.get('custom_fields[1][optional]'), 'false');
  assert.equal(f.get('custom_fields[2][key]'), 'display');
  assert.ok([...f.keys()].every(k => k.startsWith('custom_fields[')));
});

test('buildProductParams uses the current English title, description and image', () => {
  const guinea = gifts.find(g => g.id === 'guinea-radisson');
  const pp = buildProductParams(guinea, 'https://sadio.me/marrying_rehana');
  assert.equal(pp.get('name'), '2 nights at the Radisson Blu in Conakry, Guinea');
  assert.equal(pp.get('description'), guinea.description.en);
  assert.equal(pp.get('images[0]'), 'https://sadio.me/marrying_rehana/images/gifts/guinea-radisson.jpg');
});
