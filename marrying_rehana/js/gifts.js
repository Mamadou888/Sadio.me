export function sortGifts(gifts, order) {
  const dir = order === 'desc' ? -1 : 1;
  return [...gifts].sort((a, b) => dir * (a.priceUsd - b.priceUsd));
}

export function checkoutUrl(gift, lang) {
  if (!gift.paymentLink) return null;
  return lang === 'fr' ? `${gift.paymentLink}?locale=fr` : gift.paymentLink;
}

// Purchase status from the Apps Script. Any failure means "nothing gifted yet":
// the page still works, and Stripe's one-purchase limit is the backstop.
export async function loadGifts(url, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(url);
    if (!res.ok) return null;
    const body = await res.json();
    return Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

export async function loadStatus(url, fetchImpl = fetch, timeoutMs = 5000) {
  if (!url) return {};
  let timer;
  const timeout = new Promise(resolve => { timer = setTimeout(() => resolve({}), timeoutMs); });
  const request = (async () => {
    const res = await fetchImpl(url);
    if (!res.ok) return {};
    const body = await res.json();
    return body && typeof body.gifted === 'object' && body.gifted !== null ? body.gifted : {};
  })().catch(() => ({}));
  try {
    return await Promise.race([request, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
