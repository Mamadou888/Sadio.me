# Wedding Experience Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A bilingual one-page registry at `sadio.me/marrying_rehana/` where guests buy travel experiences once each through Stripe, and purchases, notes and thank-you emails run through a Google Sheet + Apps Script.

**Architecture:** Static page (HTML/CSS/vanilla ES modules) in a `marrying_rehana/` folder of the existing GitHub Pages repo. `data/gifts.json` is the single source of truth, read by the page, the Stripe link-creation script and the Apps Script. One Stripe Payment Link per gift (limit 1 purchase, 3 custom fields). An Apps Script polls Stripe every 5 minutes, writes rows to a Sheet, emails a thank-you, and serves `{gifted:{...}}` JSON that the page merges into the cards.

**Tech Stack:** HTML/CSS, vanilla JS ES modules, Node 26 `node --test` (no npm dependencies), Stripe Payment Links + REST API, Google Apps Script + Google Sheets, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-18-wedding-registry-design.md`

## Global Constraints

- All site code lives in `Sadio.me/marrying_rehana/`; work on branch `registry` cut from `gh-pages` (the branch Pages serves). Do not touch the existing site files except adding `_config.yml`.
- **Never run `git commit` or `git push` without showing the message and getting Mamadou's explicit approval** (his global CLAUDE.md). Every "Commit" step below means: propose, wait, then commit.
- No npm dependencies, no build step. `marrying_rehana/package.json` has `"type": "module"` and `"scripts": {"test": "node --test"}`.
- Charge in **USD only**. Euro display = `Math.round(usd * USD_TO_EUR)`, `USD_TO_EUR = 0.86` in `js/config.js` (update to the real rate on launch day).
- All copy (titles, descriptions, blurb, UI strings, field labels, email templates) comes verbatim from the spec.
- Default language English; default sort price ascending; ties keep `gifts.json` order.
- Secrets (Stripe keys) never go in the repo: the Node script reads `STRIPE_SECRET_KEY` from env; Apps Script reads `STRIPE_KEY` from Script Properties.
- Any guest-provided text rendered in HTML is escaped.
- Visual tokens (withjoy look): page background `#FBFAF7`, text `#333`, heading font "EB Garamond" (Google Fonts) color `#7B6B65`, body font "Inter", cards white with `border-radius: 12px` and a faint shadow, dark pill buttons `#333` with white text.

## Review Focus

1. **Status endpoint down or slow** (Apps Script quota, cold start): page must still render all gifts as available within 5 s; Stripe's purchase limit is the backstop. → Task 3 `loadStatus` tests.
2. **Guest name/note containing HTML or quotes**: rendered as text, never markup. → Task 3 `renderGiftCard` XSS test.
3. **Two guests pay for the same gift at nearly the same time**: both purchases recorded in the Sheet (so one can be refunded), site credits the earliest. → Task 5 `rowsToPublicStatus` test.
4. **"Keep private", "Name only" with a blank name, or a missing dropdown value**: no name, note or email leaks to the public JSON. → Task 5 tests.
5. **Overlapping or repeated sync runs**: no duplicate rows and no duplicate thank-you emails. → Task 5 `filterNewSessions` test + `LockService` in Task 6.

---

### Task 1: Scaffold, gift data and images

**Files:**
- Create: `_config.yml` (repo root)
- Create: `marrying_rehana/package.json`
- Create: `marrying_rehana/data/gifts.json`
- Create: `marrying_rehana/images/gifts/<id>.jpg` × 14
- Test: `marrying_rehana/tests/gifts-data.test.js`

**Interfaces:**
- Produces: `data/gifts.json` — an array of 14 `Gift` objects in the spec's table order:
  `{ id: string, priceUsd: integer, image: "images/gifts/<id>.jpg", credit: {name: string, license: string, source: string}, title: {en, fr}, description: {en, fr}, paymentLink: null, paymentLinkId: null }` (`credit` from the spec's Photo credits table)
  (`paymentLink`/`paymentLinkId` are filled in Task 7.)

- [ ] **Step 1: Create branch and scaffold**

`git checkout gh-pages && git checkout -b registry`. Root `_config.yml`:
```yaml
exclude: [docs, marrying_rehana/tests, marrying_rehana/scripts, marrying_rehana/apps-script, marrying_rehana/package.json]
```

- [ ] **Step 2: Write the failing test** `tests/gifts-data.test.js`

```js
test('has the 14 spec gifts with spec prices', () => {
  assert.deepEqual(gifts.map(g => [g.id, g.priceUsd]), [
    ['rio-carnival-beach', 20], ['vietnam-homestay', 35], ['new-orleans-mardi-gras', 50],
    ['petra-quad-bike', 70], ['kazakhstan-horseback', 80], ['indonesia-treehouse', 80],
    ['grand-canyon-fuel', 100], ['iceland-car-rental', 150], ['tahiti-dolphins', 200],
    ['guinea-radisson', 200], ['anjouan-comoros', 300], ['uganda-gorillas', 400],
    ['coachella', 600], ['serengeti-four-seasons', 2000],
  ]);
});
test('every gift has non-empty en/fr title and description', ...);   // assert each string .trim().length > 0
test('every image path is images/gifts/<id>.jpg and the file exists', ...);
test('every gift has credit.name, credit.license and a commons.wikimedia.org credit.source', ...); // fs.existsSync(new URL(`../${g.image}`, import.meta.url))
test('ids are unique and match /^[a-z0-9-]+$/', ...);
```
Load with `JSON.parse(fs.readFileSync(new URL('../data/gifts.json', import.meta.url)))`.

- [ ] **Step 3: Run test to verify it fails**

Run: `cd marrying_rehana && npm test`
Expected: FAIL (ENOENT on `data/gifts.json`).

- [ ] **Step 4: Write `data/gifts.json`** with titles/descriptions copied verbatim from the spec.

- [ ] **Step 5: Download images.** For each gift, download the 960px thumbnail of the spec's Photo credits source page (Commons API `action=query&titles=<File:…>&prop=imageinfo&iiprop=url&iiurlwidth=960`, with a `User-Agent` header and ~2 s between requests to avoid HTTP 429) to `images/gifts/<id>.jpg`. Each file < 350 KB.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test` → Expected: 4 passing.

- [ ] **Step 7: Commit** (after approval) — `feat(registry): scaffold, gift data and images`

---

### Task 2: Language and price formatting

**Files:**
- Create: `marrying_rehana/js/config.js`, `marrying_rehana/js/i18n.js`, `marrying_rehana/js/money.js`
- Test: `marrying_rehana/tests/i18n.test.js`, `marrying_rehana/tests/money.test.js`

**Interfaces:**
- Produces:
  - `config.js`: `export const USD_TO_EUR = 0.86; export const STATUS_URL = ''; export const GIFTS_URL = 'data/gifts.json'; export const STATUS_TIMEOUT_MS = 5000;`
  - `i18n.js`: `export const STRINGS: {en: Record<string,string>, fr: Record<string,string>}` (all spec UI-string keys plus `title`, `registry`, `blurb` as an array of 3 paragraphs), `export function t(lang: 'en'|'fr', key: string, vars?: Record<string,string>): string` (replaces `{name}`-style placeholders), `export function resolveLang(search: string, stored: string|null): 'en'|'fr'`
  - `money.js`: `export function formatPrice(usd: number, lang: 'en'|'fr', rate: number): string`

- [ ] **Step 1: Write the failing tests**

```js
// i18n.test.js
assert.equal(t('en', 'giftButton'), 'Gift this experience');
assert.equal(t('fr', 'from', { name: 'Fatou' }), 'de la part de Fatou');
assert.equal(t('en', 'toggle'), 'Voir en français');
assert.deepEqual(Object.keys(STRINGS.fr).sort(), Object.keys(STRINGS.en).sort());
assert.equal(resolveLang('?lang=fr', null), 'fr');
assert.equal(resolveLang('', 'fr'), 'fr');
assert.equal(resolveLang('?lang=en', 'fr'), 'en');   // URL beats storage
assert.equal(resolveLang('?lang=de', 'xx'), 'en');   // junk → English

// money.test.js  (normalize Intl's narrow/no-break spaces first)
const n = s => s.replace(/[  ]/g, ' ');
assert.equal(formatPrice(150, 'en', 0.86), '$150');
assert.equal(formatPrice(2000, 'en', 0.86), '$2,000');
assert.equal(n(formatPrice(150, 'fr', 0.86)), '≈ 129 €');
assert.equal(n(formatPrice(2000, 'fr', 0.86)), '≈ 1 720 €');
```
The `euroNote` key exists in `en` as an empty string.

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL (module not found).

- [ ] **Step 3: Implement** the three modules. `formatPrice` uses `Intl.NumberFormat` (`en-US`/USD and `fr-FR`/EUR, `maximumFractionDigits: 0`), prefixing `'≈ '` for French.

- [ ] **Step 4: Run to verify pass** — `npm test` → all passing.

- [ ] **Step 5: Commit** — `feat(registry): i18n strings and price formatting`

---

### Task 3: Gift logic and card rendering

**Files:**
- Create: `marrying_rehana/js/gifts.js`, `marrying_rehana/js/render.js`
- Test: `marrying_rehana/tests/gifts.test.js`, `marrying_rehana/tests/render.test.js`

**Interfaces:**
- Consumes: `t`, `formatPrice` (Task 2); `Gift` (Task 1).
- Produces:
  - `type GiftStatus = { name: string|null, note: string|null }`
  - `gifts.js`: `sortGifts(gifts: Gift[], order: 'asc'|'desc'): Gift[]` (new array, stable), `checkoutUrl(gift: Gift, lang): string|null` (`null` if no `paymentLink`; appends `?locale=fr` in French), `loadStatus(url: string, fetchImpl = fetch, timeoutMs = 5000): Promise<Record<string, GiftStatus>>` (returns the response's `.gifted`; returns `{}` if `url` is empty, the request rejects, is non-OK, has no `gifted` object, or exceeds the timeout)
  - `render.js`: `escapeHtml(s: string): string`, `renderGiftCard(gift: Gift, status: GiftStatus|undefined, lang, rate: number): string` (an `<article class="gift-card" data-id="<id>">`), `renderGrid(gifts, statusMap, lang, rate, order): string`, `renderCredits(gifts, lang): string` (heading `t(lang,'photoCredits')`, then one line per gift: `<title in lang> — <a href="source">name</a>, license`, escaped)

- [ ] **Step 1: Write the failing tests**

```js
// gifts.test.js
assert.deepEqual(sortGifts(gifts, 'asc').map(g => g.id).slice(0, 2), ['rio-carnival-beach', 'vietnam-homestay']);
assert.deepEqual(sortGifts(gifts, 'desc')[0].id, 'serengeti-four-seasons');
// stable ties: kazakhstan-horseback before indonesia-treehouse in both orders' tie group
assert.equal(checkoutUrl({ paymentLink: 'https://buy.stripe.com/x' }, 'fr'), 'https://buy.stripe.com/x?locale=fr');
assert.equal(checkoutUrl({ paymentLink: 'https://buy.stripe.com/x' }, 'en'), 'https://buy.stripe.com/x');
assert.equal(checkoutUrl({ paymentLink: null }, 'en'), null);
assert.deepEqual(await loadStatus('u', async () => ({ ok: true, json: async () => ({ gifted: { a: { name: 'X', note: null } } }) })), { a: { name: 'X', note: null } });
assert.deepEqual(await loadStatus('u', async () => { throw new Error('down'); }), {});
assert.deepEqual(await loadStatus('u', async () => ({ ok: false })), {});
assert.deepEqual(await loadStatus('u', () => new Promise(() => {}), 20), {});   // timeout
assert.deepEqual(await loadStatus('', fetchSpy), {});  // fetchSpy not called

// render.test.js
const card = renderGiftCard(iceland, undefined, 'en', 0.86);
// contains title.en, description.en, '$150', 'Gift this experience', href = paymentLink
const fr = renderGiftCard(iceland, undefined, 'fr', 0.86);
// contains title.fr, '≈', '?locale=fr'
const gifted = renderGiftCard(iceland, { name: 'Aunt Fatou', note: 'Have fun!' }, 'en', 0.86);
// contains 'Gifted 🤍', 'from Aunt Fatou', 'Have fun!', and no 'Gift this experience' link
const anon = renderGiftCard(iceland, { name: null, note: null }, 'en', 0.86);
// contains 'Gifted 🤍', not 'from '
const evil = renderGiftCard(iceland, { name: '<img src=x onerror=alert(1)>', note: '"><script>x</script>' }, 'en', 0.86);
assert.ok(!evil.includes('<img src=x') && !evil.includes('<script>'));
assert.ok(evil.includes('&lt;img src=x onerror=alert(1)&gt;'));
const noLink = renderGiftCard({ ...iceland, paymentLink: null }, undefined, 'en', 0.86);
// button rendered as disabled <button>, no <a href>
const credits = renderCredits(gifts, 'en');
// contains 'Photo credits', 'Dietmar Rabich', 'CC BY-SA 4.0' and the grand-canyon source URL as an href
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL.

- [ ] **Step 3: Implement** both modules. Card markup: image (`loading="lazy"`, alt = title), title, description, price, then either `<a class="btn" href=...>` or the gifted block (`.gifted`, `.gifted-from`, `<blockquote class="gifted-note">`). `escapeHtml` covers `& < > " '`.

- [ ] **Step 4: Run to verify pass** — `npm test` → all passing.

- [ ] **Step 5: Commit** — `feat(registry): gift sorting, status loading and card rendering`

---

### Task 4: The page

**Files:**
- Create: `marrying_rehana/index.html`, `marrying_rehana/css/style.css`, `marrying_rehana/js/app.js`, `marrying_rehana/images/couple.jpg`

**Interfaces:**
- Consumes: everything from Tasks 1–3.

- [ ] **Step 1: Ask Mamadou for the couple photo.** Save it as `images/couple.jpg` (max 1200px on the long edge, < 400 KB).

- [ ] **Step 2: Build `index.html` + `style.css`.** Layout top to bottom: fixed top-right language pill (`#lang-toggle`, dark `#333`, white text, ≥44px tall, always visible while scrolling); heading "Rehana & Mamadou Sadio"; section title; hero with blurb left (3 `<p>`) and couple photo right, stacking on screens < 800px; thank-you banner `#thanks` (hidden by default); toolbar with "Sort by" `<select id="sort">` and the French-only euro note; `<div id="grid">`; footer `#credits` filled by `renderCredits` (small grey text). Grid: 4 columns ≥ 1100px, 3 ≥ 800px, 2 ≥ 520px, else 1. Every text node that changes with language has a `data-i18n="<key>"` attribute. `<html lang>` follows the current language.

- [ ] **Step 3: Implement `js/app.js`.** On load: `lang = resolveLang(location.search, localStorage)` (wrap storage in try/catch), fetch `GIFTS_URL`, render the grid immediately with no status, then `loadStatus(STATUS_URL)` and re-render. The toggle flips `lang`, saves it, and re-renders texts + grid without reloading. Changing the sort re-renders. If `?gifted=<id>` is present, show `#thanks`.

- [ ] **Step 4: Verify in the browser.**

Run: `cd Sadio.me && python3 -m http.server 8000`, open `http://localhost:8000/marrying_rehana/`.
Expected: 14 cards cheapest-first ($20 Rio first, $2,000 Serengeti last); "High to low" reverses; toggle switches every string to French with `≈ … €` prices and the euro note, and survives reload; `?gifted=coachella` shows the banner; at 375px wide the toggle is still top-right and nothing scrolls sideways. Buttons are disabled (no payment links yet). `http://localhost:8000/` still shows the old homepage unchanged.

- [ ] **Step 5: Run unit tests** — `npm test` → all passing.

- [ ] **Step 6: Commit** — `feat(registry): registry page`

---

### Task 5: Apps Script purchase logic (pure functions)

**Files:**
- Create: `marrying_rehana/apps-script/Lib.js`, `marrying_rehana/apps-script/package.json` (`{"type": "commonjs"}`)
- Test: `marrying_rehana/tests/apps-script-lib.test.js` (loads Lib via `createRequire(import.meta.url)('../apps-script/Lib.js')`)

**Interfaces:**
- Consumes: Stripe Checkout Session objects (`id`, `created`, `payment_status`, `payment_link`, `amount_total`, `locale`, `customer_details.{email,name}`, `custom_fields[]` with `key` and `text.value` / `dropdown.value`); `Gift` (Task 1, with `paymentLinkId`).
- Produces (plain functions; ends with `if (typeof module !== 'undefined') module.exports = {...}` so the same file pastes into Apps Script unchanged):
  - `ROW_FIELDS = ['created_at','gift_id','gift_title','amount_usd','guest_email','checkout_name','display_name','note','display_choice','locale','session_id','thank_you_sent']`
  - `filterNewSessions(sessions, existingIds: string[]): Session[]` — keeps `payment_status === 'paid'`, drops ids in `existingIds` and duplicates within `sessions`
  - `sessionToRow(session, giftsByLinkId: Record<string, Gift>): Row` — `created_at` ISO string, `amount_usd = amount_total / 100`, trimmed text fields (`''` if absent), `display_choice` ∈ `namenote|nameonly|private` (anything else → `private`), `locale` default `'en'`, `gift_id`/`gift_title` = `'unknown'` when the link isn't found, `thank_you_sent: false`
  - `rowsToPublicStatus(rows: Row[]): { gifted: Record<string, {name: string|null, note: string|null}> }` — earliest `created_at` per gift wins; skips `'unknown'`; applies the spec's display table; empty strings become `null`; never includes email
  - `fillTemplate(str: string, vars: Record<string,string>): string` — replaces `{{key}}`
  - `buildThankYouEmail(templates, row: Row, gift: Gift|undefined): {subject, body}` — `fr` template if `row.locale` starts with `fr`, else `en`; `name` = `display_name` || `checkout_name` || `templates[lang].fallbackName`; `gift` = `gift.title[lang]` || `row.gift_title`

- [ ] **Step 1: Write the failing tests** (build sessions with a small `session({...overrides})` helper)

```js
// filterNewSessions
assert.deepEqual(filterNewSessions([s1, s1dup, unpaid, s2], ['cs_2']).map(s => s.id), ['cs_1']);
// sessionToRow
const row = sessionToRow(session({ payment_link: 'plink_ice', amount_total: 15000,
  custom_fields: [{ key: 'guestname', text: { value: '  Fatou ' } }, { key: 'guestnote', text: { value: 'Enjoy!' } }, { key: 'display', dropdown: { value: 'namenote' } }] }), { plink_ice: iceland });
assert.equal(row.gift_id, 'iceland-car-rental'); assert.equal(row.amount_usd, 150);
assert.equal(row.display_name, 'Fatou'); assert.equal(row.display_choice, 'namenote');
assert.equal(sessionToRow(session({ custom_fields: [] }), {}).display_choice, 'private');
assert.equal(sessionToRow(session({ payment_link: 'plink_nope' }), {}).gift_id, 'unknown');
// rowsToPublicStatus
assert.deepEqual(rowsToPublicStatus([row({ gift_id: 'a', display_choice: 'private', display_name: 'X', note: 'N' })]), { gifted: { a: { name: null, note: null } } });
assert.deepEqual(rowsToPublicStatus([row({ gift_id: 'a', display_choice: 'nameonly', display_name: '', note: 'N' })]).gifted.a, { name: null, note: null });
assert.deepEqual(rowsToPublicStatus([row({ gift_id: 'a', display_choice: 'namenote', display_name: 'X', note: 'N' })]).gifted.a, { name: 'X', note: 'N' });
// double purchase: later row listed first, earliest still wins
assert.equal(rowsToPublicStatus([row({ gift_id: 'a', created_at: '2027-01-02T00:00:00Z', display_choice: 'nameonly', display_name: 'Late' }), row({ gift_id: 'a', created_at: '2027-01-01T00:00:00Z', display_choice: 'nameonly', display_name: 'Early' })]).gifted.a.name, 'Early');
assert.ok(!JSON.stringify(rowsToPublicStatus([row({ guest_email: 'x@y.z', display_choice: 'namenote' })])).includes('x@y.z'));
assert.deepEqual(Object.keys(rowsToPublicStatus([row({ gift_id: 'unknown' })]).gifted), []);
// emails
const tpl = { en: { subject: 'Thanks', body: 'Hi {{name}}, {{gift}}', fallbackName: 'friend' }, fr: { subject: 'Merci', body: 'Bonjour {{name}}, {{gift}}', fallbackName: 'à vous' } };
assert.deepEqual(buildThankYouEmail(tpl, row({ locale: 'fr-FR', display_name: '', checkout_name: '' }), iceland), { subject: 'Merci', body: `Bonjour à vous, ${iceland.title.fr}` });
assert.equal(buildThankYouEmail(tpl, row({ locale: 'auto', display_name: '', checkout_name: 'Sam Lee' }), iceland).body, `Hi Sam Lee, ${iceland.title.en}`);
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL.
- [ ] **Step 3: Implement `apps-script/Lib.js`.**
- [ ] **Step 4: Run to verify pass** — `npm test` → all passing.
- [ ] **Step 5: Commit** — `feat(registry): apps script purchase logic`

---

### Task 6: Apps Script backend (Sheet, sync, email, status endpoint)

**Files:**
- Create: `marrying_rehana/apps-script/Code.gs`, `marrying_rehana/apps-script/SETUP.md`
- Modify: `marrying_rehana/js/config.js` (`STATUS_URL`)

**Interfaces:**
- Consumes: all of `Lib.js` (Task 5); `https://sadio.me/marrying_rehana/data/gifts.json` (needs Task 1 deployed, so this task's live verification runs after the Task 8 deploy step, or use the raw GitHub URL of the `registry` branch until then: `GIFTS_URL` constant at the top of `Code.gs`).
- Produces: web app URL `https://script.google.com/macros/s/<id>/exec` returning `{"gifted": {...}}`; Sheet tab `Purchases` with `ROW_FIELDS` as the header row.

`Code.gs` contents (signatures; bodies are straightforward Apps Script):
- Constants: `GIFTS_URL`, `SHEET_NAME = 'Purchases'`, `EMAIL_TEMPLATES` (spec's EN/FR subjects and bodies, `fallbackName` `'friend'` / `'à vous'`), `SENDER_NAME = 'Mamadou & Rehana'`, `REPLY_TO = 'mamadou888@gmail.com'`.
- `doGet()` → `ContentService` JSON of `rowsToPublicStatus(readRows_())`.
- `syncPurchases()` → under `LockService.getScriptLock().tryLock(30000)` (return if not acquired): list Stripe sessions `GET https://api.stripe.com/v1/checkout/sessions?status=complete&limit=100&created[gte]=<LAST_CREATED>` (paginate with `starting_after` while `has_more`), `filterNewSessions` against existing `session_id`s, for each: `sessionToRow` → append row → if `guest_email`, `MailApp.sendEmail({to, subject, body, name: SENDER_NAME, replyTo: REPLY_TO})` and set that row's `thank_you_sent` to `TRUE` → save max `created` as Script Property `LAST_CREATED`.
- `installTrigger()` → deletes existing `syncPurchases` triggers, creates one every 5 minutes; also writes the header row if the sheet is empty.
- Helpers: `getGiftsByLinkId_()`, `readRows_()` (rows → objects by header), `appendRow_(row)`, `stripeGet_(path, params)` (Basic auth with Script Property `STRIPE_KEY`).

- [ ] **Step 1: Write `Code.gs`** to the signatures above.

- [ ] **Step 2: Write `apps-script/SETUP.md`** for Mamadou, signed in as `mamadou888@gmail.com`:
  1. Create Google Sheet "Wedding Registry Purchases" → Extensions → Apps Script.
  2. Create files `Lib.gs` and `Code.gs`; paste the repo files' contents.
  3. Project Settings → Script Properties: `STRIPE_KEY` = Stripe restricted key with **Checkout Sessions: Read** only (from Task 7; test-mode key first), `LAST_CREATED` = `0`.
  4. Run `installTrigger` once; accept the permission prompts (Sheets, external requests, send email).
  5. Deploy → New deployment → Web app, Execute as **Me**, Who has access **Anyone** → copy the `/exec` URL.
  6. Updating code later: Deploy → Manage deployments → edit → New version (keeps the same URL).

- [ ] **Step 3: Set `STATUS_URL`** in `js/config.js` to the `/exec` URL.

- [ ] **Step 4: Verify.** Run: `curl -sL "<exec URL>"` → Expected: `{"gifted":{}}`. Run `syncPurchases` manually in the editor → Expected: no error, no rows (no purchases yet). Reload the local page → no console errors, all gifts available.

- [ ] **Step 5: Commit** — `feat(registry): apps script backend`

---

### Task 7: Stripe account and payment links

**Files:**
- Create: `marrying_rehana/scripts/create-payment-links.mjs`
- Modify: `marrying_rehana/data/gifts.json` (script writes `paymentLink`, `paymentLinkId`)
- Test: `marrying_rehana/tests/payment-links.test.js`

**Interfaces:**
- Consumes: `Gift` (Task 1).
- Produces: `export function buildPaymentLinkParams(gift: Gift, priceId: string, siteUrl: string): URLSearchParams`; `export function selectGifts(gifts: Gift[], opts: {reset: boolean, only: string|null}): Gift[]` (default: gifts without `paymentLinkId`; `reset`: all; `only`: just that id, even if it already has a link; throws `Unknown gift id: <id>` if `only` matches nothing); CLI `STRIPE_SECRET_KEY=sk_... node scripts/create-payment-links.mjs [--reset | --only <id>]`. With `--only`, if the gift already has a `paymentLinkId`, the script first deactivates that link (`POST /v1/payment_links/<id>` with `active=false`) so the old price can't be bought. For each selected gift it creates Product (`name` = `title.en`, `description` = `description.en`, `images[0]` = `${siteUrl}/${gift.image}`) → Price (`unit_amount = priceUsd * 100`, `currency = usd`) → Payment Link, then writes `paymentLink` (`url`) and `paymentLinkId` (`id`) back into `gifts.json` (2-space JSON). `siteUrl = 'https://sadio.me/marrying_rehana'`. Main runs only when executed directly (`import.meta.url === pathToFileURL(process.argv[1]).href`).

- [ ] **Step 1: Mamadou sets up Stripe** (instructions to hand him):
  1. Sign up at dashboard.stripe.com with `mamadou888@gmail.com`; business type **Individual / sole proprietor**; description "Wedding registry for travel experiences"; website `https://sadio.me/marrying_rehana`; add the bank account for payouts.
  2. Settings → Payment methods: leave Cards, Apple Pay, Google Pay and Link on.
  3. Settings → Customer emails: optional "Successful payments" receipts (on is fine; our thank-you email is separate).
  4. Developers → API keys, **test mode**: copy the secret key (`sk_test_…`) for the script; create a **restricted key** with only *Checkout Sessions: Read* for the Apps Script (`STRIPE_KEY`, Task 6).

- [ ] **Step 2: Write the failing test**

```js
const p = buildPaymentLinkParams(iceland, 'price_123', 'https://sadio.me/marrying_rehana');
assert.equal(p.get('line_items[0][price]'), 'price_123');
assert.equal(p.get('line_items[0][quantity]'), '1');
assert.equal(p.get('restrictions[completed_sessions][limit]'), '1');
assert.equal(p.get('after_completion[type]'), 'redirect');
assert.equal(p.get('after_completion[redirect][url]'), 'https://sadio.me/marrying_rehana/?gifted=iceland-car-rental');
assert.equal(p.get('inactive_message'), 'This gift has already been given. Thank you! 🤍 / Ce cadeau a déjà été offert. Merci ! 🤍');
assert.equal(p.get('custom_fields[0][key]'), 'guestname');
assert.equal(p.get('custom_fields[0][label][custom]'), 'Name to show / Nom à afficher');
assert.equal(p.get('custom_fields[0][optional]'), 'true');
assert.equal(p.get('custom_fields[0][text][maximum_length]'), '60');
assert.equal(p.get('custom_fields[1][key]'), 'guestnote');
assert.equal(p.get('custom_fields[1][label][custom]'), 'A note for us / Un mot pour nous');
assert.equal(p.get('custom_fields[1][text][maximum_length]'), '255');
assert.equal(p.get('custom_fields[2][key]'), 'display');
assert.equal(p.get('custom_fields[2][type]'), 'dropdown');
assert.equal(p.get('custom_fields[2][optional]'), 'false');
assert.equal(p.get('custom_fields[2][label][custom]'), 'Show on the registry? / Afficher ?');
assert.deepEqual([0, 1, 2].map(i => p.get(`custom_fields[2][dropdown][options][${i}][value]`)), ['namenote', 'nameonly', 'private']);
assert.deepEqual([0, 1, 2].map(i => p.get(`custom_fields[2][dropdown][options][${i}][label]`)), ['Name & note / Nom et mot', 'Name only / Nom seulement', 'Keep private / Rester privé']);
// every custom label ≤ 50 chars (Stripe limit)

// selectGifts — a = no link, b = has link
assert.deepEqual(selectGifts([a, b], { reset: false, only: null }).map(g => g.id), ['a']);
assert.deepEqual(selectGifts([a, b], { reset: true, only: null }).map(g => g.id), ['a', 'b']);
assert.deepEqual(selectGifts([a, b], { reset: false, only: 'b' }).map(g => g.id), ['b']);
assert.throws(() => selectGifts([a, b], { reset: false, only: 'nope' }), /Unknown gift id: nope/);
```
Each custom field also sets `[label][type]=custom` and `[type]` (`text` for 0 and 1).

- [ ] **Step 3: Run to verify failure** — `npm test` → FAIL.
- [ ] **Step 4: Implement** `scripts/create-payment-links.mjs` (plain `fetch` to `https://api.stripe.com/v1/...`, `Authorization: Bearer $STRIPE_SECRET_KEY`, form-encoded bodies; exit non-zero with the Stripe error message on any non-2xx).
- [ ] **Step 5: Run to verify pass** — `npm test` → all passing.
- [ ] **Step 6: Create test-mode links.** Run: `STRIPE_SECRET_KEY=sk_test_… node scripts/create-payment-links.mjs`. Expected: 14 lines `<id> → https://buy.stripe.com/test_…`; `gifts.json` has all 14 links; local page buttons now open Stripe checkout showing the three fields, and in French mode the checkout is in French (if Stripe ignores `?locale=fr`, it still auto-detects the browser language; note this and move on).
- [ ] **Step 7: Commit** — `feat(registry): stripe payment link script and test links`

---

### Task 8: Deploy, end-to-end test, go live

**Files:**
- Modify: `marrying_rehana/data/gifts.json` (live links), `marrying_rehana/js/config.js` (`USD_TO_EUR` current rate)

- [ ] **Step 1: Deploy (ask Mamadou before pushing).** Merge `registry` into `gh-pages` and `git push origin gh-pages`. Expected within ~2 min: `https://sadio.me/marrying_rehana/` serves the page, `https://sadio.me/` is unchanged, `https://sadio.me/docs/…` returns 404. If `Code.gs` used a raw GitHub `GIFTS_URL`, switch it to `https://sadio.me/marrying_rehana/data/gifts.json` and redeploy a new version.

- [ ] **Step 2: Test-mode purchase.** Buy the $20 Rio gift with card `4242 4242 4242 4242`, any future date/CVC, name "Test Guest", note "Test note", "Name & note". Expected: redirect to `?gifted=rio-carnival-beach` with the banner; within 5 min a Sheet row with all fields and `thank_you_sent = TRUE`, the email in the inbox you used; site shows "Gifted 🤍 / from Test Guest / Test note"; opening the Rio link again shows the inactive message.

- [ ] **Step 3: Second test purchase in French** with "Keep private" on another gift → French checkout, French email, card shows only "Offert 🤍".

- [ ] **Step 4: Go live.** In Stripe switch to live mode; create a live restricted key (*Checkout Sessions: Read*) → set it as `STRIPE_KEY`; delete the test rows from the Sheet; set `LAST_CREATED` to `0`. Run `STRIPE_SECRET_KEY=sk_live_… node scripts/create-payment-links.mjs --reset`. Update `USD_TO_EUR` to the day's rate. Run `npm test`. Commit (after approval) `chore(registry): live payment links`, push (after approval).

- [ ] **Step 5: Live smoke test.** Expected: `https://sadio.me/marrying_rehana/` buttons point to `https://buy.stripe.com/` (no `test_`), `curl -sL <exec URL>` → `{"gifted":{}}`. Optionally buy the $20 gift with a real card, check the row and email, then refund it in Stripe and delete its Sheet row.
