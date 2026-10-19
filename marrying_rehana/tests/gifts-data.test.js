import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const gifts = JSON.parse(fs.readFileSync(new URL('../data/gifts.json', import.meta.url)));

test('has the 23 spec gifts with spec prices', () => {
  assert.deepEqual(gifts.map(g => [g.id, g.priceUsd]), [
    ['nyc-dollar-slice', 1.5], ['nyc-chopped-cheese', 5.5], ['thailand-mango-sticky-rice', 10], ['rio-carnival-beach', 20], ['vietnam-homestay', 35],
    ['eiffel-tower', 38], ['nigeria-entry-fee', 45], ['new-orleans-mardi-gras', 50], ['petra-quad-bike', 70], ['cartagena-cooking-class', 75],
    ['indonesia-treehouse', 80], ['kazakhstan-horseback', 95], ['grand-canyon-fuel', 100], ['disneyland', 110],
    ['guinea-radisson', 125], ['iceland-car-rental', 150], ['tahiti-dolphins', 200], ['anjouan-comoros', 250],
    ['nyc-helicopter', 300], ['uganda-gorillas', 400], ['coachella', 600], ['saudi-umrah', 1000],
    ['serengeti-four-seasons', 2000],
  ]);
});

test('every gift has non-empty en/fr title and description', () => {
  for (const g of gifts) {
    for (const field of ['title', 'description']) {
      for (const lang of ['en', 'fr']) {
        assert.ok(g[field]?.[lang]?.trim().length > 0, `${g.id} ${field}.${lang}`);
      }
    }
  }
});

test('every image path is images/gifts/<id>.jpg and the file exists', () => {
  for (const g of gifts) {
    assert.equal(g.image, `images/gifts/${g.id}.jpg`);
    assert.ok(fs.existsSync(new URL(`../${g.image}`, import.meta.url)), `missing ${g.image}`);
  }
});

test('every gift has credit.name, credit.license and a commons.wikimedia.org credit.source', () => {
  for (const g of gifts) {
    assert.ok(g.credit?.name?.trim(), `${g.id} credit.name`);
    assert.ok(g.credit?.license?.trim(), `${g.id} credit.license`);
    assert.match(g.credit?.source ?? '', /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/, g.id);
  }
});

test('ids are unique and match /^[a-z0-9-]+$/', () => {
  const ids = gifts.map(g => g.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-z0-9-]+$/);
});
