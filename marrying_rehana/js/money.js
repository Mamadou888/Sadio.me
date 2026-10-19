const formatters = {};

function formatter(locale, currency, cents) {
  const key = `${locale}|${cents}`;
  formatters[key] ??= new Intl.NumberFormat(locale, {
    style: 'currency', currency, minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0,
  });
  return formatters[key];
}

// Whole-dollar gifts show whole amounts; gifts with cents (e.g. $1.50) keep them.
export function formatPrice(priceUsd, lang, rate) {
  const cents = !Number.isInteger(priceUsd);
  if (lang === 'fr') {
    const eur = cents ? Math.round(priceUsd * rate * 100) / 100 : Math.round(priceUsd * rate);
    return `≈ ${formatter('fr-FR', 'EUR', cents).format(eur)}`;
  }
  return formatter('en-US', 'USD', cents).format(priceUsd);
}
