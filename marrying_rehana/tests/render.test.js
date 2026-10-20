import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { escapeHtml, renderGiftCard, renderGrid, renderCredits } from '../js/render.js';

const gifts = JSON.parse(fs.readFileSync(new URL('../data/gifts.json', import.meta.url)));
const iceland = { ...gifts.find(g => g.id === 'iceland-car-rental'), paymentLink: 'https://buy.stripe.com/ice' };

test('escapeHtml escapes the five HTML characters', () => {
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
});

test('available card in English shows title, description, price and checkout link', () => {
  const card = renderGiftCard(iceland, undefined, 'en', 0.86);
  assert.ok(card.includes('data-id="iceland-car-rental"'));
  assert.ok(card.includes(escapeHtml(iceland.title.en)));
  assert.ok(card.includes(escapeHtml(iceland.description.en)));
  assert.ok(card.includes('$150'));
  assert.ok(card.includes('Gift this experience'));
  assert.ok(card.includes('href="https://buy.stripe.com/ice"'));
});

test('available card in French shows French text, euros and French checkout', () => {
  const card = renderGiftCard(iceland, undefined, 'fr', 0.86);
  assert.ok(card.includes(escapeHtml(iceland.title.fr)));
  assert.ok(card.includes('≈'));
  assert.ok(card.includes('href="https://buy.stripe.com/ice?locale=fr"'));
});

test('gifted card shows name and note instead of the button', () => {
  const card = renderGiftCard(iceland, { name: 'Aunt Fatou', note: 'Have fun!' }, 'en', 0.86);
  assert.ok(card.includes('Gifted 🤍'));
  assert.ok(card.includes('by Aunt Fatou'));
  assert.ok(card.includes('Have fun!'));
  assert.ok(!card.includes('Gift this experience'));
  assert.ok(!card.includes('buy.stripe.com'));
});

test('anonymous gifted card shows only Gifted', () => {
  const card = renderGiftCard(iceland, { name: null, note: null }, 'en', 0.86);
  assert.ok(card.includes('Gifted 🤍'));
  assert.ok(!card.includes('gifted-from'));
  assert.ok(!card.includes('<blockquote'));
});

test('guest name and note are escaped', () => {
  const card = renderGiftCard(iceland, { name: '<img src=x onerror=alert(1)>', note: '"><script>x</script>' }, 'en', 0.86);
  assert.ok(!card.includes('<img src=x'));
  assert.ok(!card.includes('<script>'));
  assert.ok(card.includes('&lt;img src=x onerror=alert(1)&gt;'));
});

test('card without a payment link renders a disabled button', () => {
  const card = renderGiftCard({ ...iceland, paymentLink: null }, undefined, 'en', 0.86);
  assert.ok(card.includes('<button'));
  assert.ok(card.includes('disabled'));
  assert.ok(!card.includes('href='));
});

test('renderGrid renders every gift in the requested order with status', () => {
  const grid = renderGrid(gifts, { coachella: { name: 'Sam', note: null } }, 'en', 0.86, 'desc');
  const order = [...grid.matchAll(/data-id="([^"]+)"/g)].map(m => m[1]);
  assert.equal(order.length, gifts.length);
  assert.equal(order[0], 'serengeti-four-seasons');
  assert.ok(grid.includes('by Sam'));
});

test('renderCredits lists each photographer, license and linked source', () => {
  const credits = renderCredits(gifts, 'en');
  const canyon = gifts.find(g => g.id === 'grand-canyon-fuel');
  assert.ok(credits.includes('Photo credits'));
  assert.ok(credits.includes('Dietmar Rabich'));
  assert.ok(credits.includes('CC BY-SA 4.0'));
  assert.ok(credits.includes(`href="${escapeHtml(canyon.credit.source)}"`));
  assert.ok(renderCredits(gifts, 'fr').includes('Crédits photo'));
});

test('renderCredits is a collapsed disclosure with the heading as its toggle', () => {
  const credits = renderCredits(gifts, 'en');
  assert.match(credits, /^<details class="credits-toggle"><summary>Photo credits<\/summary>/);
  assert.ok(!credits.includes('<details open'));
  assert.ok(credits.trimEnd().endsWith('</details>'));
});

import { renderThanks } from '../js/render.js';

test('renderThanks names the gift that was just bought, escaped, in each language', () => {
  const coron = gifts.find(g => g.id === 'coron-snorkeling');
  assert.equal(renderThanks(coron, 'en'), 'Thank you so much for gifting us “Snorkeling in Coron, Philippines”! 🤍 Check your inbox for a little note from us.');
  assert.ok(renderThanks(coron, 'fr').startsWith('Merci infiniment de nous avoir offert « Du snorkeling à Coron, aux Philippines » !'));
  assert.ok(renderThanks({ title: { en: '<b>x</b>' } }, 'en').includes('&lt;b&gt;x&lt;/b&gt;'));
});

test('renderThanks falls back to the general thank-you for an unknown gift', () => {
  assert.equal(renderThanks(undefined, 'en'), 'Thank you so much! 🤍 Check your inbox for a little note from us.');
});
