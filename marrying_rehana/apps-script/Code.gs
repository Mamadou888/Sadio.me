// Wedding registry backend. Paste into the Apps Script project bound to the
// "Wedding Registry Purchases" Google Sheet, next to Lib.gs. Setup: SETUP.md.

// Read from GitHub directly so purchases record even if sadio.me's HTTPS certificate has a problem.
const GIFTS_URL = 'https://raw.githubusercontent.com/Mamadou888/Sadio.me/gh-pages/marrying_rehana/data/gifts.json';
const SHEET_NAME = 'Purchases';
const SENDER_NAME = 'Mamadou & Rehana';
const REPLY_TO = 'mamadou888@gmail.com';

// Our photo at the top of the thank-you email.
const EMAIL_IMAGE_URL = 'https://sadio.me/marrying_rehana/images/email-couple.jpg';

// Edit the thank-you emails here. {{name}} and {{gift}} are filled in for you.
// Each paragraph is its own entry; the email adds the spacing.
const EMAIL_TEMPLATES = {
  en: {
    subject: 'Thank you for your gift 🤍',
    greeting: 'Hi {{name}} 👋',
    paragraphs: [
      'Thank you so much for gifting us "{{gift}}"\u00a0🎁', // \u00a0 keeps 🎁 on the same line as the gift
      'It truly means the world to us. We are extremely grateful.',
      "When we finally do it, we'll send you a message and a photo from wherever we are 📸🌍",
    ],
    closing: 'Let the adventures begin ✈️🥳',
    signoff: 'With love,',
    signature: 'Mamadou & Rehana 🤍',
    fallbackName: 'friend',
  },
  fr: {
    subject: 'Merci pour votre cadeau 🤍',
    greeting: 'Bonjour {{name}} 👋',
    paragraphs: [
      'Merci infiniment de nous avoir offert « {{gift}} »\u00a0🎁',
      'Cela nous touche énormément. Nous vous sommes extrêmement reconnaissants.',
      'Le jour venu, nous vous enverrons un message et une photo, où que nous soyons 📸🌍',
    ],
    closing: 'Que les aventures commencent ✈️🥳',
    signoff: 'Avec tout notre amour,',
    signature: 'Mamadou & Rehana 🤍',
    fallbackName: 'à vous',
  },
};

// Run from the editor to see the thank-you email in your own inbox. Nothing is written to the sheet.
function sendTestThankYou() {
  const row = { display_name: 'Mamadou', locale: 'en', gift_title: 'A test gift' };
  const email = buildThankYouEmail(EMAIL_TEMPLATES, row, undefined, EMAIL_IMAGE_URL);
  MailApp.sendEmail({ to: REPLY_TO, subject: email.subject, body: email.body, htmlBody: email.htmlBody, name: SENDER_NAME });
}

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
          const email = buildThankYouEmail(EMAIL_TEMPLATES, row, giftsById[row.gift_id], EMAIL_IMAGE_URL);
          MailApp.sendEmail({ to: row.guest_email, subject: email.subject, body: email.body, htmlBody: email.htmlBody, name: SENDER_NAME, replyTo: REPLY_TO });
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

// Run once from the editor: adds the header row if missing and schedules syncPurchases every 5 minutes.
function installTrigger() {
  const sheet = getSheet_();
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(ROW_FIELDS);
  } else if (!hasHeaderRow(sheet.getRange(1, 1, 1, ROW_FIELDS.length).getValues())) {
    sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, ROW_FIELDS.length).setValues([ROW_FIELDS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
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
