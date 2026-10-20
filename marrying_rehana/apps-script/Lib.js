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

function hasHeaderRow(values) {
  return values.length > 0 && values[0][0] === ROW_FIELDS[0];
}

// Reads by column position (ROW_FIELDS order), so a missing or edited header row can't break it.
function rowsFromValues(values) {
  return values
    .filter(cells => cells[0] !== ROW_FIELDS[0])
    .map(cells => {
      const row = {};
      ROW_FIELDS.forEach((name, i) => {
        const v = cells[i];
        row[name] = v instanceof Date ? v.toISOString() : v;
      });
      return row;
    });
}

function rowsToPublicStatus(rows) {
  const gifted = {};
  const sorted = rows.slice().sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  for (const r of sorted) {
    if (!r.gift_id || r.gift_id === 'unknown' || gifted[r.gift_id]) continue;
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

function escapeEmailHtml_(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Returns a plain-text body plus an HTML version: our photo on top, then the template's sections.
function buildThankYouEmail(templates, row, gift, imageUrl) {
  const lang = String(row.locale || '').indexOf('fr') === 0 ? 'fr' : 'en';
  const tpl = templates[lang];
  const vars = {
    name: row.display_name || row.checkout_name || tpl.fallbackName,
    gift: (gift && gift.title[lang]) || row.gift_title,
  };
  const text = s => fillTemplate(s, vars);
  const html = s => fillTemplate(escapeEmailHtml_(s), {
    name: escapeEmailHtml_(vars.name),
    gift: '<strong>' + escapeEmailHtml_(vars.gift) + '</strong>',
  });

  const body = [text(tpl.greeting)].concat(tpl.paragraphs.map(text), [text(tpl.closing), text(tpl.signoff) + '\n' + text(tpl.signature)])
    .join('\n\n');

  const p = 'margin:0 0 18px;font-size:16px;line-height:1.6;color:#333;';
  const htmlBody = [
    '<div style="background:#FBFAF7;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;">',
    '<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:14px;padding:32px 28px;text-align:center;">',
    imageUrl ? '<img src="' + escapeEmailHtml_(imageUrl) + '" alt="Rehana &amp; Mamadou" width="240" style="width:240px;max-width:100%;border-radius:10px;margin:0 0 24px;">' : '',
    '<p style="margin:0 0 20px;font-family:Georgia,serif;font-size:24px;color:#7B6B65;">' + html(tpl.greeting) + '</p>',
    tpl.paragraphs.map(s => '<p style="' + p + '">' + html(s) + '</p>').join(''),
    '<p style="margin:26px 0;font-family:Georgia,serif;font-size:22px;color:#7B6B65;">' + html(tpl.closing) + '</p>',
    '<p style="' + p + 'margin:0;">' + html(tpl.signoff) + '<br>' + html(tpl.signature) + '</p>',
    '</div></div>',
  ].join('');

  return { subject: text(tpl.subject), body: body, htmlBody: htmlBody };
}

if (typeof module !== 'undefined') {
  module.exports = { ROW_FIELDS, hasHeaderRow, rowsFromValues, syncWindowStart, shouldSendThankYou, filterNewSessions, sessionToRow, rowsToPublicStatus, fillTemplate, buildThankYouEmail };
}
