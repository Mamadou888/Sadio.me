import { t } from './i18n.js';
import { formatPrice } from './money.js';
import { sortGifts, checkoutUrl } from './gifts.js';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ESCAPES[c]);
}

function renderAction(gift, status, lang) {
  if (status) {
    const from = status.name ? `<p class="gifted-from">${escapeHtml(t(lang, 'by', { name: status.name }))}</p>` : '';
    const note = status.note ? `<blockquote class="gifted-note">${escapeHtml(status.note)}</blockquote>` : '';
    return `<div class="gifted"><p class="gifted-label">${escapeHtml(t(lang, 'gifted'))}</p>${from}${note}</div>`;
  }
  const url = checkoutUrl(gift, lang);
  const label = escapeHtml(t(lang, 'giftButton'));
  return url
    ? `<a class="btn" href="${escapeHtml(url)}">${label}</a>`
    : `<button class="btn" type="button" disabled>${label}</button>`;
}

export function renderGiftCard(gift, status, lang, rate) {
  const title = escapeHtml(gift.title[lang]);
  return `<article class="gift-card${status ? ' is-gifted' : ''}" data-id="${escapeHtml(gift.id)}">
  <img src="${escapeHtml(gift.image)}" alt="${title}" loading="lazy">
  <h3 class="gift-title">${title}</h3>
  <p class="gift-desc">${escapeHtml(gift.description[lang])}</p>
  <p class="gift-price">${escapeHtml(formatPrice(gift.priceUsd, lang, rate))}</p>
  ${renderAction(gift, status, lang)}
</article>`;
}

export function renderGrid(gifts, statusMap, lang, rate, order) {
  return sortGifts(gifts, order).map(g => renderGiftCard(g, statusMap[g.id], lang, rate)).join('\n');
}

// Text only (escaped); app.js puts it in the banner.
export function renderThanks(gift, lang) {
  const title = gift?.title?.[lang] ?? gift?.title?.en;
  return escapeHtml(title ? t(lang, 'thanksFor', { gift: title }) : t(lang, 'thanks'));
}

export function renderCredits(gifts, lang) {
  const items = gifts.map(g =>
    `<li>${escapeHtml(g.title[lang])} — <a href="${escapeHtml(g.credit.source)}">${escapeHtml(g.credit.name)}</a>, ${escapeHtml(g.credit.license)}</li>`);
  return `<details class="credits-toggle"><summary>${escapeHtml(t(lang, 'photoCredits'))}</summary><ul>${items.join('')}</ul></details>`;
}
