const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export function formatPrice(priceUsd, lang, rate) {
  if (lang === 'fr') return `≈ ${eur.format(Math.round(priceUsd * rate))}`;
  return usd.format(priceUsd);
}
