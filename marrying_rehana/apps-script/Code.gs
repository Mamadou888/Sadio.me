// Wedding registry backend. Paste into the Apps Script project bound to the
// "Wedding Registry Purchases" Google Sheet, next to Lib.gs. Setup: SETUP.md.

// Read from GitHub directly so purchases record even if sadio.me's HTTPS certificate has a problem.
const GIFTS_URL = 'https://raw.githubusercontent.com/Mamadou888/Sadio.me/gh-pages/marrying_rehana/data/gifts.json';
const SHEET_NAME = 'Purchases';
const SENDER_NAME = 'Mamadou & Rehana';
const REPLY_TO = 'mamadou888@gmail.com';

// Edit the thank-you emails here. {{name}} and {{gift}} are filled in for you.
const EMAIL_TEMPLATES = {
  en: {
    subject: 'Thank you for your gift 🤍',
    body: [
      'Hi {{name}},',
      '',
      'Thank you so much for gifting us "{{gift}}". It truly means the world to us.',
      "When we finally do it, we'll send you a message and a photo from wherever we are.",
      '',
      'With love,',
      'Mamadou & Rehana',
    ].join('\n'),
    fallbackName: 'friend',
  },
  fr: {
    subject: 'Merci pour votre cadeau 🤍',
    body: [
      'Bonjour {{name}},',
      '',
      'Merci infiniment de nous avoir offert « {{gift}} ». Cela nous touche énormément.',
      'Le jour venu, nous vous enverrons un message et une photo, où que nous soyons.',
      '',
      'Avec tout notre amour,',
      'Mamadou & Rehana',
    ].join('\n'),
    fallbackName: 'à vous',
  },
};

// Public endpoint the registry page reads: which gifts are taken, plus the name/note guests chose to show.
function doGet() {
  return ContentService.createTextOutput(JSON.stringify(rowsToPublicStatus(readRows_())))
    .setMimeType(ContentService.MimeType.JSON);
}

// Runs every 5 minutes: copies new paid Stripe checkouts into the sheet and emails a thank-you.
function syncPurchases() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    const props = PropertiesService.getScriptProperties();
    const since = Number(props.getProperty('LAST_CREATED') || 0);
    const sessions = listCompletedSessions_(syncWindowStart(since));
    if (sessions.length === 0) return;

    const existingIds = readRows_().map(r => r.session_id);
    const fresh = filterNewSessions(sessions, existingIds).sort((a, b) => a.created - b.created);
    const giftsByLinkId = fresh.length ? getGiftsByLinkId_() : {};
    const giftsById = {};
    Object.keys(giftsByLinkId).forEach(k => { giftsById[giftsByLinkId[k].id] = giftsByLinkId[k]; });

    for (const session of fresh) {
      const row = sessionToRow(session, giftsByLinkId);
      const rowNumber = appendRow_(row);
      if (shouldSendThankYou(row)) {
        try {
          const email = buildThankYouEmail(EMAIL_TEMPLATES, row, giftsById[row.gift_id]);
          MailApp.sendEmail({ to: row.guest_email, subject: email.subject, body: email.body, name: SENDER_NAME, replyTo: REPLY_TO });
          getSheet_().getRange(rowNumber, ROW_FIELDS.indexOf('thank_you_sent') + 1).setValue(true);
        } catch (err) {
          console.error('Thank-you email failed for ' + row.session_id + ': ' + err);
        }
      }
    }
    const maxCreated = Math.max.apply(null, sessions.map(s => s.created));
    props.setProperty('LAST_CREATED', String(Math.max(since, maxCreated)));
  } finally {
    lock.releaseLock();
  }
}

// Run once from the editor: prepares the sheet and schedules syncPurchases every 5 minutes.
function installTrigger() {
  const sheet = getSheet_();
  if (sheet.getLastRow() === 0) sheet.appendRow(ROW_FIELDS);
  sheet.getRange('A:A').setNumberFormat('@'); // keep timestamps as ISO text
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'syncPurchases')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncPurchases').timeBased().everyMinutes(5).create();
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}

function readRows_() {
  const sheet = getSheet_();
  if (sheet.getLastRow() === 0) return [];
  return rowsFromValues(sheet.getDataRange().getValues());
}

// Guest-typed text starting with = + - @ would otherwise run as a spreadsheet formula.
function safeCell_(value) {
  return typeof value === 'string' && /^[=+\-@]/.test(value) ? "'" + value : value;
}

function appendRow_(row) {
  const sheet = getSheet_();
  if (sheet.getLastRow() === 0) sheet.appendRow(ROW_FIELDS);
  sheet.appendRow(ROW_FIELDS.map(f => safeCell_(row[f])));
  return sheet.getLastRow();
}

function getGiftsByLinkId_() {
  const res = UrlFetchApp.fetch(GIFTS_URL, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Could not load gifts from ' + GIFTS_URL + ': HTTP ' + res.getResponseCode());
  const gifts = JSON.parse(res.getContentText());
  const byLink = {};
  gifts.forEach(g => { if (g.paymentLinkId) byLink[g.paymentLinkId] = g; });
  return byLink;
}

function stripeGet_(path, params) {
  const key = PropertiesService.getScriptProperties().getProperty('STRIPE_KEY');
  const query = Object.keys(params)
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
    .join('&');
  const res = UrlFetchApp.fetch('https://api.stripe.com/v1/' + path + '?' + query, {
    headers: { Authorization: 'Bearer ' + key },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('Stripe ' + res.getResponseCode() + ': ' + res.getContentText());
  }
  return JSON.parse(res.getContentText());
}

function listCompletedSessions_(sinceCreated) {
  const all = [];
  let startingAfter = null;
  do {
    const params = { status: 'complete', limit: 100, 'created[gte]': sinceCreated };
    if (startingAfter) params.starting_after = startingAfter;
    const page = stripeGet_('checkout/sessions', params);
    all.push.apply(all, page.data);
    startingAfter = page.has_more && page.data.length ? page.data[page.data.length - 1].id : null;
  } while (startingAfter);
  return all;
}
