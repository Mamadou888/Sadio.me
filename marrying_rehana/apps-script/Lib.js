// Pure purchase logic. Pasted into Apps Script as Lib.gs unchanged; also unit-tested in Node.

var ROW_FIELDS = ['created_at', 'gift_id', 'gift_title', 'amount_usd', 'guest_email', 'checkout_name',
  'display_name', 'note', 'display_choice', 'locale', 'session_id', 'thank_you_sent'];

var DISPLAY_CHOICES = ['namenote', 'nameonly', 'private'];

// Stripe stamps a session when checkout opens, not when it is paid, so a guest who
// opened checkout before the last cutoff can pay after it. Sessions expire within
// 24 hours, so looking back a day catches them; session_id dedupe absorbs the overlap.
function syncWindowStart(lastCreated) {
  return Math.max(0, lastCreated - 86400);
}

function shouldSendThankYou(row) {
  return Boolean(row.guest_email) && row.gift_id !== 'unknown';
}

function filterNewSessions(sessions, existingIds) {
  const seen = new Set(existingIds);
  return sessions.filter(s => {
    if (s.payment_status !== 'paid' || seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}

function customField_(session, key) {
  const field = (session.custom_fields || []).find(f => f.key === key);
  if (!field) return '';
  const value = (field.text && field.text.value) || (field.dropdown && field.dropdown.value) || '';
  return String(value).trim();
}

function sessionToRow(session, giftsByLinkId) {
  const gift = giftsByLinkId[session.payment_link];
  const details = session.customer_details || {};
  const display = customField_(session, 'display');
  return {
    created_at: new Date(session.created * 1000).toISOString(),
    gift_id: gift ? gift.id : 'unknown',
    gift_title: gift ? gift.title.en : 'unknown',
    amount_usd: (session.amount_total || 0) / 100,
    guest_email: details.email || '',
    checkout_name: (details.name || '').trim(),
    display_name: customField_(session, 'guestname'),
    note: customField_(session, 'guestnote'),
    display_choice: DISPLAY_CHOICES.includes(display) ? display : 'private',
    locale: session.locale || 'en',
    session_id: session.id,
    thank_you_sent: false,
  };
}

function rowsToPublicStatus(rows) {
  const gifted = {};
  const sorted = rows.slice().sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  for (const r of sorted) {
    if (r.gift_id === 'unknown' || gifted[r.gift_id]) continue;
    const showName = r.display_choice === 'namenote' || r.display_choice === 'nameonly';
    const showNote = r.display_choice === 'namenote';
    gifted[r.gift_id] = {
      name: showName && r.display_name ? String(r.display_name) : null,
      note: showNote && r.note ? String(r.note) : null,
    };
  }
  return { gifted: gifted };
}

function fillTemplate(str, vars) {
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] == null ? '' : vars[k]));
}

function buildThankYouEmail(templates, row, gift) {
  const lang = String(row.locale || '').indexOf('fr') === 0 ? 'fr' : 'en';
  const tpl = templates[lang];
  const vars = {
    name: row.display_name || row.checkout_name || tpl.fallbackName,
    gift: (gift && gift.title[lang]) || row.gift_title,
  };
  return { subject: fillTemplate(tpl.subject, vars), body: fillTemplate(tpl.body, vars) };
}

if (typeof module !== 'undefined') {
  module.exports = { ROW_FIELDS, syncWindowStart, shouldSendThankYou, filterNewSessions, sessionToRow, rowsToPublicStatus, fillTemplate, buildThankYouEmail };
}
