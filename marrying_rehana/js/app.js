import { GIFTS_URL, STATUS_URL, STATUS_TIMEOUT_MS, USD_TO_EUR } from './config.js';
import { STRINGS, t, resolveLang } from './i18n.js';
import { loadStatus } from './gifts.js';
import { escapeHtml, renderGrid, renderCredits } from './render.js';

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
  document.getElementById('blurb').innerHTML =
    STRINGS[state.lang].blurb.map(p => `<p>${escapeHtml(p)}</p>`).join('');
  document.getElementById('euro-note').hidden = !t(state.lang, 'euroNote');
}

function renderGifts() {
  document.getElementById('grid').innerHTML = renderGrid(state.gifts, state.status, state.lang, USD_TO_EUR, state.order);
  document.getElementById('credits').innerHTML = renderCredits(state.gifts, state.lang);
}

function render() {
  renderTexts();
  renderGifts();
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

if (new URLSearchParams(location.search).has('gifted')) {
  document.getElementById('thanks').hidden = false;
}

renderTexts();
state.gifts = await (await fetch(GIFTS_URL)).json();
renderGifts();
state.status = await loadStatus(STATUS_URL, fetch, STATUS_TIMEOUT_MS);
renderGifts();
