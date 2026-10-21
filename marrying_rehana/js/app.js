import { GIFTS_URL, STATUS_URL, STATUS_TIMEOUT_MS, USD_TO_EUR } from './config.js';
import { STRINGS, t, resolveLang } from './i18n.js';
import { loadGifts, loadStatus } from './gifts.js';
import { escapeHtml, renderGrid, renderCredits, renderThanks } from './render.js';

const LANG_KEY = 'registry-lang';

function readStoredLang() {
  try { return localStorage.getItem(LANG_KEY); } catch { return null; }
}

function storeLang(lang) {
  try { localStorage.setItem(LANG_KEY, lang); } catch { /* private mode: not remembered */ }
}

const state = {
  lang: resolveLang(location.search, readStoredLang()),
  order: 'asc',
  gifts: [],
  status: {},
};

function renderTexts() {
  document.documentElement.lang = state.lang;
  for (const el of document.querySelectorAll('[data-i18n]')) {
    el.textContent = t(state.lang, el.dataset.i18n);
  }
  const underline = escapeHtml(t(state.lang, 'blurbUnderline'));
  document.getElementById('blurb').innerHTML = STRINGS[state.lang].blurb
    .map(p => `<p>${escapeHtml(p).replace(underline, `<u>${underline}</u>`)}</p>`)
    .join('');
  document.getElementById('euro-note').hidden = !t(state.lang, 'euroNote');
}

const giftedId = new URLSearchParams(location.search).get('gifted');

function renderThanksBanner() {
  if (!giftedId) return;
  const gift = state.gifts.find(g => g.id === giftedId);
  document.getElementById('thanks-text').innerHTML = renderThanks(gift, state.lang);
  document.getElementById('thanks-close').setAttribute('aria-label', t(state.lang, 'close'));
}

function renderGifts() {
  document.getElementById('grid').innerHTML = renderGrid(state.gifts, state.status, state.lang, USD_TO_EUR, state.order);
  document.getElementById('credits').innerHTML = renderCredits(state.gifts, state.lang);
}

function render() {
  renderTexts();
  renderGifts();
  renderThanksBanner();
}

document.getElementById('lang-toggle').addEventListener('click', () => {
  state.lang = state.lang === 'en' ? 'fr' : 'en';
  storeLang(state.lang);
  render();
});

document.getElementById('sort').addEventListener('change', e => {
  state.order = e.target.value;
  renderGifts();
});

if (giftedId) {
  document.getElementById('thanks').hidden = false;
  document.getElementById('thanks-close').addEventListener('click', () => {
    document.getElementById('thanks').hidden = true;
  });
}

renderTexts();
renderThanksBanner();
const gifts = await loadGifts(GIFTS_URL);
if (!gifts) {
  document.getElementById('grid').innerHTML = `<p class="load-error">${escapeHtml(t(state.lang, 'loadError'))}</p>`;
  throw new Error(`Could not load ${GIFTS_URL}`);
}
state.gifts = gifts;
renderGifts();
renderThanksBanner();
state.status = await loadStatus(STATUS_URL, fetch, STATUS_TIMEOUT_MS);
renderGifts();
