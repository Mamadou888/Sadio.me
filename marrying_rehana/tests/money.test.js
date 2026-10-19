import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPrice } from '../js/money.js';

const n = s => s.replace(/[  ]/g, ' ');

test('English shows whole US dollars', () => {
  assert.equal(formatPrice(150, 'en', 0.86), '$150');
  assert.equal(formatPrice(2000, 'en', 0.86), '$2,000');
});

test('French shows approximate whole euros', () => {
  assert.equal(n(formatPrice(150, 'fr', 0.86)), '≈ 129 €');
  assert.equal(n(formatPrice(2000, 'fr', 0.86)), '≈ 1 720 €');
});

test('prices with cents keep their cents', () => {
  assert.equal(formatPrice(1.5, 'en', 0.86), '$1.50');
  assert.equal(n(formatPrice(1.5, 'fr', 0.86)), '≈ 1,29 €');
});
