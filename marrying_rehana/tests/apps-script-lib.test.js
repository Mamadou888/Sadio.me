import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ROW_FIELDS, filterNewSessions, sessionToRow, rowsToPublicStatus, fillTemplate, buildThankYouEmail } =
  require('../apps-script/Lib.js');

const gifts = JSON.parse(fs.readFileSync(new URL('../data/gifts.json', import.meta.url)));
const iceland = { ...gifts.find(g => g.id === 'iceland-car-rental'), paymentLinkId: 'plink_ice' };

const session = (o = {}) => ({
  id: 'cs_1', created: 1798761600, payment_status: 'paid', payment_link: 'plink_ice',
  amount_total: 15000, locale: null,
  customer_details: { email: 'guest@example.com', name: 'Card Holder' },
  custom_fields: [], ...o,
});
const row = (o = {}) => ({
  created_at: '2027-01-01T00:00:00.000Z', gift_id: 'a', gift_title: 'A', amount_usd: 20,
  guest_email: 'g@example.com', checkout_name: '', display_name: '', note: '',
  display_choice: 'private', locale: 'en', session_id: 'cs_x', thank_you_sent: false, ...o,
});

test('ROW_FIELDS matches the sheet columns', () => {
  assert.deepEqual(ROW_FIELDS, ['created_at', 'gift_id', 'gift_title', 'amount_usd', 'guest_email', 'checkout_name',
    'display_name', 'note', 'display_choice', 'locale', 'session_id', 'thank_you_sent']);
});

test('filterNewSessions keeps paid, unseen, non-duplicate sessions', () => {
  const s1 = session({ id: 'cs_1' });
  const s2 = session({ id: 'cs_2' });
  const unpaid = session({ id: 'cs_3', payment_status: 'unpaid' });
  assert.deepEqual(filterNewSessions([s1, { ...s1 }, unpaid, s2], ['cs_2']).map(s => s.id), ['cs_1']);
});

test('sessionToRow maps a purchase with name, note and display choice', () => {
  const r = sessionToRow(session({ custom_fields: [
    { key: 'guestname', type: 'text', text: { value: '  Fatou ' } },
    { key: 'guestnote', type: 'text', text: { value: 'Enjoy!' } },
    { key: 'display', type: 'dropdown', dropdown: { value: 'namenote' } },
  ] }), { plink_ice: iceland });
  assert.deepEqual(Object.keys(r), ROW_FIELDS);
  assert.equal(r.gift_id, 'iceland-car-rental');
  assert.equal(r.gift_title, iceland.title.en);
  assert.equal(r.amount_usd, 150);
  assert.equal(r.guest_email, 'guest@example.com');
  assert.equal(r.checkout_name, 'Card Holder');
  assert.equal(r.display_name, 'Fatou');
  assert.equal(r.note, 'Enjoy!');
  assert.equal(r.display_choice, 'namenote');
  assert.equal(r.locale, 'en');
  assert.equal(r.session_id, 'cs_1');
  assert.equal(r.created_at, '2027-01-01T00:00:00.000Z');
  assert.equal(r.thank_you_sent, false);
});

test('sessionToRow defaults: missing fields are empty, unknown display is private', () => {
  const r = sessionToRow(session({ custom_fields: [{ key: 'display', dropdown: { value: 'everything' } }], customer_details: null }), {});
  assert.equal(r.display_choice, 'private');
  assert.equal(r.display_name, '');
  assert.equal(r.note, '');
  assert.equal(r.guest_email, '');
  assert.equal(sessionToRow(session({ custom_fields: [] }), {}).display_choice, 'private');
});

test('sessionToRow marks unknown payment links', () => {
  const r = sessionToRow(session({ payment_link: 'plink_nope' }), { plink_ice: iceland });
  assert.equal(r.gift_id, 'unknown');
  assert.equal(r.gift_title, 'unknown');
});

test('sessionToRow keeps the checkout locale', () => {
  assert.equal(sessionToRow(session({ locale: 'fr' }), {}).locale, 'fr');
});

test('rowsToPublicStatus hides name and note for private', () => {
  assert.deepEqual(rowsToPublicStatus([row({ display_choice: 'private', display_name: 'X', note: 'N' })]),
    { gifted: { a: { name: null, note: null } } });
});

test('rowsToPublicStatus name only: name shown, note hidden, blank name is null', () => {
  assert.deepEqual(rowsToPublicStatus([row({ display_choice: 'nameonly', display_name: 'X', note: 'N' })]).gifted.a, { name: 'X', note: null });
  assert.deepEqual(rowsToPublicStatus([row({ display_choice: 'nameonly', display_name: '', note: 'N' })]).gifted.a, { name: null, note: null });
});

test('rowsToPublicStatus name and note: both shown', () => {
  assert.deepEqual(rowsToPublicStatus([row({ display_choice: 'namenote', display_name: 'X', note: 'N' })]).gifted.a, { name: 'X', note: 'N' });
});

test('rowsToPublicStatus credits the earliest buyer of a gift', () => {
  const status = rowsToPublicStatus([
    row({ created_at: '2027-01-02T00:00:00.000Z', display_choice: 'nameonly', display_name: 'Late' }),
    row({ created_at: '2027-01-01T00:00:00.000Z', display_choice: 'nameonly', display_name: 'Early' }),
  ]);
  assert.equal(status.gifted.a.name, 'Early');
});

test('rowsToPublicStatus never exposes email and skips unknown gifts', () => {
  assert.ok(!JSON.stringify(rowsToPublicStatus([row({ guest_email: 'x@y.z', display_choice: 'namenote', display_name: 'X' })])).includes('x@y.z'));
  assert.deepEqual(rowsToPublicStatus([row({ gift_id: 'unknown' })]), { gifted: {} });
});

test('fillTemplate replaces {{key}} placeholders', () => {
  assert.equal(fillTemplate('Hi {{name}}, {{gift}}!', { name: 'Sam', gift: 'Rio' }), 'Hi Sam, Rio!');
});

const tpl = {
  en: { subject: 'Thanks', greeting: 'Hi {{name}}', paragraphs: ['You gave "{{gift}}".', 'Photos soon.'],
    closing: 'Adventures!', signoff: 'Love,', signature: 'M & R', fallbackName: 'friend' },
  fr: { subject: 'Merci', greeting: 'Bonjour {{name}}', paragraphs: ['Vous avez offert « {{gift}} ».'],
    closing: 'Aventures !', signoff: 'Bises,', signature: 'M & R', fallbackName: 'à vous' },
};

test('buildThankYouEmail lays out the plain-text body with blank lines between sections', () => {
  assert.equal(buildThankYouEmail(tpl, row({ display_name: 'Fatou' }), iceland).body,
    `Hi Fatou\n\nYou gave "${iceland.title.en}".\n\nPhotos soon.\n\nAdventures!\n\nLove,\nM & R`);
});

test('buildThankYouEmail uses French for fr locales and the fallback name', () => {
  const email = buildThankYouEmail(tpl, row({ locale: 'fr-FR' }), iceland);
  assert.equal(email.subject, 'Merci');
  assert.ok(email.body.startsWith(`Bonjour à vous\n\nVous avez offert « ${iceland.title.fr} ».`));
});

test('buildThankYouEmail prefers display name, then cardholder name', () => {
  assert.ok(buildThankYouEmail(tpl, row({ locale: 'auto', checkout_name: 'Sam Lee' }), iceland).body.startsWith('Hi Sam Lee\n'));
  assert.ok(buildThankYouEmail(tpl, row({ display_name: 'Fatou', checkout_name: 'Sam Lee' }), iceland).body.startsWith('Hi Fatou\n'));
});

test('buildThankYouEmail falls back to the row title for unknown gifts', () => {
  assert.ok(buildThankYouEmail(tpl, row({ gift_title: 'Mystery' }), undefined).body.includes('You gave "Mystery".'));
});

test('buildThankYouEmail htmlBody shows our photo, every section and the gift in bold', () => {
  const html = buildThankYouEmail(tpl, row({ display_name: 'Fatou' }), iceland, 'https://sadio.me/us.jpg').htmlBody;
  assert.ok(html.includes('<img src="https://sadio.me/us.jpg"'));
  for (const text of ['Hi Fatou', 'Photos soon.', 'Adventures!', 'Love,', 'M &amp; R']) assert.ok(html.includes(text), text);
  assert.ok(html.includes(`<strong>${iceland.title.en}</strong>`));
});

test('buildThankYouEmail htmlBody escapes what guests typed and skips the photo without a URL', () => {
  const html = buildThankYouEmail(tpl, row({ display_name: '<b>Sam</b>' }), iceland).htmlBody;
  assert.ok(html.includes('Hi &lt;b&gt;Sam&lt;/b&gt;'));
  assert.ok(!html.includes('<b>Sam'));
  assert.ok(!html.includes('<img'));
});

test('syncWindowStart looks back 24 hours so late-paid checkouts are not skipped', () => {
  const { syncWindowStart } = require('../apps-script/Lib.js');
  assert.equal(syncWindowStart(1798761600), 1798761600 - 86400);
  assert.equal(syncWindowStart(0), 0);
  assert.equal(syncWindowStart(1000), 0);
});

test('shouldSendThankYou only for registry gifts with an email', () => {
  const { shouldSendThankYou } = require('../apps-script/Lib.js');
  assert.equal(shouldSendThankYou(row({ gift_id: 'coachella', guest_email: 'g@x.com' })), true);
  assert.equal(shouldSendThankYou(row({ gift_id: 'unknown', guest_email: 'g@x.com' })), false);
  assert.equal(shouldSendThankYou(row({ gift_id: 'coachella', guest_email: '' })), false);
});

test('rowsFromValues maps sheet rows by column position and skips the header row', () => {
  const { rowsFromValues } = require('../apps-script/Lib.js');
  const data = ['2027-01-01T00:00:00.000Z', 'coachella', 'Our first Coachella', 600, 'g@x.com', 'Card', 'Sam', 'Hi', 'namenote', 'en', 'cs_1', true];
  assert.deepEqual(rowsFromValues([ROW_FIELDS, data]).map(r => [r.gift_id, r.session_id]), [['coachella', 'cs_1']]);
  assert.deepEqual(rowsFromValues([data]).map(r => r.gift_id), ['coachella']);
  assert.deepEqual(rowsFromValues([]), []);
});

test('rowsFromValues turns Sheets dates back into ISO strings', () => {
  const { rowsFromValues } = require('../apps-script/Lib.js');
  const r = rowsFromValues([[new Date('2027-01-01T00:00:00Z'), 'a']])[0];
  assert.equal(r.created_at, '2027-01-01T00:00:00.000Z');
});

test('rowsToPublicStatus ignores rows without a gift id', () => {
  assert.deepEqual(rowsToPublicStatus([row({ gift_id: undefined }), row({ gift_id: '' })]), { gifted: {} });
});

test('hasHeaderRow is true only when row 1 is the ROW_FIELDS header', () => {
  const { hasHeaderRow } = require('../apps-script/Lib.js');
  assert.equal(hasHeaderRow([ROW_FIELDS, ['2027-01-01', 'a']]), true);
  assert.equal(hasHeaderRow([['2027-01-01', 'a']]), false);
  assert.equal(hasHeaderRow([]), false);
});
