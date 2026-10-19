import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS, t, resolveLang } from '../js/i18n.js';

test('t returns the string for the language', () => {
  assert.equal(t('en', 'giftButton'), 'Gift this experience');
  assert.equal(t('fr', 'giftButton'), 'Offrir cette expérience');
});

test('t fills {name} placeholders', () => {
  assert.equal(t('fr', 'from', { name: 'Fatou' }), 'de la part de Fatou');
  assert.equal(t('en', 'from', { name: 'Fatou' }), 'from Fatou');
});

test('toggle label names the other language', () => {
  assert.equal(t('en', 'toggle'), 'Voir en français');
  assert.equal(t('fr', 'toggle'), 'View in English');
});

test('en and fr have the same keys', () => {
  assert.deepEqual(Object.keys(STRINGS.fr).sort(), Object.keys(STRINGS.en).sort());
});

test('blurb is three paragraphs in each language', () => {
  assert.equal(STRINGS.en.blurb.length, 3);
  assert.equal(STRINGS.fr.blurb.length, 3);
});

test('euro note only has text in French', () => {
  assert.equal(t('en', 'euroNote'), '');
  assert.ok(t('fr', 'euroNote').includes('dollars américains'));
});

test('resolveLang: URL beats storage, junk falls back to English', () => {
  assert.equal(resolveLang('?lang=fr', null), 'fr');
  assert.equal(resolveLang('', 'fr'), 'fr');
  assert.equal(resolveLang('?lang=en', 'fr'), 'en');
  assert.equal(resolveLang('?lang=de', 'xx'), 'en');
  assert.equal(resolveLang('', null), 'en');
});

test('loadError message exists in both languages', () => {
  assert.ok(t('en', 'loadError').includes('refresh'));
  assert.ok(t('fr', 'loadError').includes('actualiser'));
});

test('third blurb paragraph opens with the "future moment" sentence', () => {
  assert.ok(STRINGS.en.blurb[2].startsWith('So every gift here is a future moment: a trip, an adventure, a meal we dream of experiencing together.'));
  assert.ok(STRINGS.fr.blurb[2].startsWith('Alors chaque cadeau ici est un moment à venir : un voyage, une aventure, un repas que nous rêvons de vivre ensemble.'));
});

test('made-with-love line credits both of us in each language', () => {
  assert.equal(t('en', 'madeWith'), 'Made with love by Rehana (Designer) and Mamadou (Engineer) ❤️');
  assert.equal(t('fr', 'madeWith'), 'Fait avec amour par Rehana (designer) et Mamadou (ingénieur) ❤️');
});
